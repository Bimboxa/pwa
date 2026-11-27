import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import computeExteriorContours from "Features/geometry/utils/computeExteriorContours";
import { FRONTIER_DETECTION_M } from "Features/geometry/utils/splitChainsAtFrontierEdges";
import createContourAnnotationsService from "Features/annotations/services/createContourAnnotationsService";

import db from "App/db/db";

/**
 * Contour(s) of a POLYGON selection. A single polygon contributes its
 * exterior ring verbatim; several polygons go through the frontier
 * classification (shared edges dropped, exterior chains stitched) — one
 * closed contour per spatially connected cluster, exterior perimeter only.
 * Every cut (hole) of every polygon adds its own closed contour, so a single
 * polygon yields the same rings as a clone to POLYLINE.
 */
export default function usePolygonContours() {
  const dispatch = useDispatch();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();

  const computeContours = useCallback(
    async ({
      polygonAnnotations,
      boundaryAnnotationTemplate,
      outputType = "POLYLINE",
    }) => {
      if (!polygonAnnotations?.length || !boundaryAnnotationTemplate) {
        throw new Error(
          "polygonAnnotations and boundaryAnnotationTemplate are required"
        );
      }

      const imageSize = baseMap?.getImageSize?.();
      const { width, height } = imageSize ?? {};
      if (!width || !height) throw new Error("No image size available");

      const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
      if (!meterByPx || meterByPx <= 0)
        throw new Error("meterByPx is required");

      // ── 1. Resolve exterior rings + cut rings (px, typed) ─────────────
      const allPointIds = [];
      const collectPointIds = (points) => {
        if (!Array.isArray(points)) return;
        for (const p of points)
          if (p.id && (p.x === undefined || p.y === undefined))
            allPointIds.push(p.id);
      };
      for (const ann of polygonAnnotations) {
        collectPointIds(ann.points);
        if (Array.isArray(ann.cuts))
          for (const cut of ann.cuts) collectPointIds(cut?.points);
      }
      const pointRecords = allPointIds.length
        ? await db.points.bulkGet(allPointIds)
        : [];
      const pointsById = {};
      for (const pt of pointRecords) if (pt) pointsById[pt.id] = pt;

      // Returns the ring in px (point `type` kept for S-C-S arcs), or null
      // when fewer than 3 points resolve.
      const resolveRing = (points) => {
        if (!Array.isArray(points) || points.length < 3) return null;
        const pts = [];
        for (const p of points) {
          if (p.x !== undefined && p.y !== undefined) {
            pts.push({ x: p.x, y: p.y, type: p.type });
          } else {
            const rec = pointsById[p.id];
            if (rec)
              pts.push({ x: rec.x * width, y: rec.y * height, type: p.type });
          }
        }
        return pts.length >= 3 ? pts : null;
      };

      const rings = [];
      const holeRings = [];
      for (const ann of polygonAnnotations) {
        const ring = resolveRing(ann.points);
        if (!ring) continue;
        rings.push(ring);
        if (Array.isArray(ann.cuts))
          for (const cut of ann.cuts) {
            const holeRing = resolveRing(cut?.points);
            if (holeRing) holeRings.push(holeRing);
          }
      }

      if (rings.length === 0)
        throw new Error("No valid polygon annotations found");

      // ── 2. Contour geometry ────────────────────────────────────────────
      const frontierPx = Math.max(FRONTIER_DETECTION_M / meterByPx, 1);
      const contours =
        rings.length === 1
          ? [rings[0]]
          : computeExteriorContours(rings, { frontierPx });

      if (contours.length === 0) throw new Error("No contour produced");

      // ── 3. Persist ─────────────────────────────────────────────────────
      const groups = [
        ...contours.map((typedPoints) => ({ typedPoints, closed: true })),
        ...holeRings.map((typedPoints) => ({
          typedPoints,
          closed: true,
          isHole: true,
        })),
      ];

      const { count } = await createContourAnnotationsService({
        groups,
        boundaryAnnotationTemplate,
        outputType,
        baseMapId,
        projectId,
        activeLayerId,
        imageSize,
      });

      dispatch(triggerAnnotationsUpdate());

      console.log(`[usePolygonContours] Created ${count} contour annotations`);
      return { count };
    },
    [baseMap, baseMapId, projectId, activeLayerId, dispatch]
  );

  return computeContours;
}
