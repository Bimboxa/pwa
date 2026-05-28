import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";

import db from "App/db/db";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import orthogonalConvexOutline from "Features/geometry/utils/orthogonalConvexOutline";

function parseMappingCategory(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const parts = entry.split(":");
    if (parts.length !== 2) return null;
    const [nomenclatureKey, categoryKey] = parts.map((s) => s.trim());
    if (!nomenclatureKey || !categoryKey) return null;
    return { nomenclatureKey, categoryKey };
  }
  if (entry.nomenclatureKey && entry.categoryKey) return entry;
  return null;
}

const coordKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;

const ON_SEG_EPS = 1.2; // px tolerance for "point lies on segment"

// Is P on segment AB (collinear within eps AND between A and B)? Returns the
// param t in [0,1] along A->B, or null.
function paramOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return null;
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const slack = ON_SEG_EPS / Math.sqrt(len2);
  if (t < -slack || t > 1 + slack) return null;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
  if (d2 > ON_SEG_EPS * ON_SEG_EPS) return null;
  return Math.max(0, Math.min(1, t));
}

/**
 * Close the global envelope of the selected polylines/contours: wrap all their
 * points in an orthogonal convex outline (rectilinear staircase, no inward
 * notches) and add the outline segments that are not already drawn by an
 * existing contour edge. Outline corners reuse existing points only; a step that
 * cannot land on an existing point stays diagonal — so NO new point is created.
 */
export default function useCloseEnvelope() {
  const dispatch = useDispatch();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ annotations, annotationTemplateId }) => {
    const template = await db.annotationTemplates.get(annotationTemplateId);
    if (!template) return [];

    const polylines = (annotations ?? []).filter(
      (a) =>
        a?.type === "POLYLINE" &&
        Array.isArray(a.points) &&
        a.points.length >= 2
    );
    if (polylines.length === 0) return [];

    const baseMapId = polylines[0].baseMapId;

    // ── 1. Collect points (dedupe by id) + coord->id map + existing segments ──
    const points = [];
    const idByCoord = new Map();
    const seenId = new Set();
    const existingSegments = []; // { ax, ay, bx, by } in pixel space
    const ek = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

    for (const annotation of polylines) {
      const pts = annotation.points;
      for (const p of pts) {
        if (!p?.id || p.x == null || p.y == null) continue;
        if (!seenId.has(p.id)) {
          seenId.add(p.id);
          points.push({ id: p.id, x: p.x, y: p.y });
          idByCoord.set(coordKey(p.x, p.y), p.id);
        }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i];
        const q = pts[i + 1];
        if (p?.x == null || q?.x == null) continue;
        existingSegments.push({ ax: p.x, ay: p.y, bx: q.x, by: q.y });
      }
    }
    if (points.length < 3) return [];

    // a sub-segment is "already drawn" if its midpoint lies on an existing segment
    const isCovered = (x1, y1, x2, y2) => {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      for (const s of existingSegments) {
        if (paramOnSegment(mx, my, s.ax, s.ay, s.bx, s.by) != null) return true;
      }
      return false;
    };

    // ── 2. Orthogonal convex outline (existing points only) ───────────────
    const isExisting = (x, y) => idByCoord.has(coordKey(x, y));
    const { loop } = orthogonalConvexOutline(points, isExisting);
    if (loop.length < 2) return [];

    // ── 3. Closing segments = outline edges not already drawn ──────────────
    const templateProps = getAnnotationTemplateProps(template);
    const listingId = template.listingId;
    const mappingCategories = (template.mappingCategories ?? [])
      .map(parseMappingCategory)
      .filter(Boolean);

    const allAnnotations = [];
    const allMappingRels = [];
    const createdPairs = new Set();

    const addSegment = (aId, bId, x1, y1, x2, y2) => {
      if (!aId || !bId || aId === bId) return;
      // never re-trace over an existing wall segment
      if (isCovered(x1, y1, x2, y2)) return;
      const pairKey = ek(aId, bId);
      if (createdPairs.has(pairKey)) return;
      createdPairs.add(pairKey);

      const id = nanoid();
      allAnnotations.push({
        ...templateProps,
        id,
        type: "POLYLINE",
        annotationTemplateId,
        annotationTemplateProps: { label: template.label },
        listingId,
        projectId,
        baseMapId,
        points: [{ id: aId }, { id: bId }],
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      });

      for (const mc of mappingCategories) {
        allMappingRels.push({
          id: nanoid(),
          annotationId: id,
          projectId,
          nomenclatureKey: mc.nomenclatureKey,
          categoryKey: mc.categoryKey,
          source: "annotationTemplate",
        });
      }
    };

    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) continue;

      // split the outline edge on every existing point that lies on it, so each
      // sub-segment is either fully over an existing wall (skipped) or a real gap.
      const breakpoints = [];
      for (const p of points) {
        const t = paramOnSegment(p.x, p.y, a.x, a.y, b.x, b.y);
        if (t != null) breakpoints.push({ id: p.id, x: p.x, y: p.y, t });
      }
      breakpoints.sort((u, v) => u.t - v.t);
      // dedupe consecutive identical ids / coincident t
      const chain = [];
      for (const bp of breakpoints) {
        const last = chain[chain.length - 1];
        if (last && (last.id === bp.id || Math.abs(last.t - bp.t) < 1e-6)) continue;
        chain.push(bp);
      }

      for (let j = 0; j < chain.length - 1; j++) {
        const p = chain[j];
        const q = chain[j + 1];
        addSegment(p.id, q.id, p.x, p.y, q.x, q.y);
      }
    }

    if (allAnnotations.length === 0) return [];

    // ── 4. Bulk write (no db.points — every point id is reused) ──────────
    await db.transaction(
      "rw",
      [db.annotations, db.relAnnotationMappingCategory],
      async () => {
        await db.annotations.bulkAdd(allAnnotations);
        if (allMappingRels.length > 0)
          await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
      }
    );

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return allAnnotations;
  };
}
