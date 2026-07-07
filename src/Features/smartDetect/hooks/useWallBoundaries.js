import { useCallback } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";
import polygonClipping from "polygon-clipping";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import {
  circleFromThreePoints,
  expandArcsInPath,
  extractArcCircles,
  typeOf,
} from "Features/geometry/utils/arcSampling";
import collapseArcsInPolyline from "Features/geometry/utils/collapseArcsInPolyline";
import wallToRectRing, {
  segNormal,
} from "Features/geometry/utils/wallToRectRing";
import offsetControlPolyline from "Features/geometry/utils/offsetControlPolyline";

import db from "App/db/db";

// Number of straight samples each S-C-S arc is expanded into before the
// offset + polygon-clipping union. Denser than the bare minimum so the
// miter-joined offset vertices sit close to the true concentric circle and
// collapseArcsInPolyline can re-fit the arc on the output.
const ARC_SAMPLES = 16;

/**
 * Classify an edge midpoint: find the nearest wall and determine side.
 */
function classifyEdge(p1, p2, walls, centroid) {
  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;

  let bestDist = Infinity;
  let bestWall = null;
  let bestCross = 0;

  for (const wall of walls) {
    const pts = wall.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(
        0,
        Math.min(1, ((mx - a.x) * dx + (my - a.y) * dy) / lenSq)
      );
      const px = a.x + t * dx,
        py = a.y + t * dy;
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestWall = wall;
        bestCross = dx * (my - a.y) - dy * (mx - a.x); // >0 = left of segment
      }
    }
  }

  if (!bestWall) return "INTERIOR";
  if (bestWall.side === "INT") return "INTERIOR";

  // For EXT walls: determine which side faces exterior using centroid
  const midIdx = Math.floor(bestWall.points.length / 2);
  const mA = bestWall.points[midIdx];
  const mB = bestWall.points[Math.min(midIdx + 1, bestWall.points.length - 1)];
  const norm = segNormal(mA, mB);
  const leftPt = {
    x: mA.x + norm.x * bestWall.halfWidth,
    y: mA.y + norm.y * bestWall.halfWidth,
  };
  const dLeft = (leftPt.x - centroid.x) ** 2 + (leftPt.y - centroid.y) ** 2;
  const rightPt = {
    x: mA.x - norm.x * bestWall.halfWidth,
    y: mA.y - norm.y * bestWall.halfWidth,
  };
  const dRight = (rightPt.x - centroid.x) ** 2 + (rightPt.y - centroid.y) ** 2;
  const leftIsExterior = dLeft > dRight;

  // bestCross > 0 = edge is on left side of wall
  if (bestCross > 0) return leftIsExterior ? "EXT_EXTERIOR" : "EXT_INTERIOR";
  return leftIsExterior ? "EXT_INTERIOR" : "EXT_EXTERIOR";
}

/**
 * Group consecutive edges of the same type into polylines.
 * Since the ring is closed, merge first and last group if same type.
 */
function groupEdgesByType(ring, walls, centroid) {
  if (ring.length < 3) return [];

  const edges = [];
  for (let i = 0; i < ring.length - 1; i++) {
    edges.push({
      p1: ring[i],
      p2: ring[i + 1],
      type: classifyEdge(ring[i], ring[i + 1], walls, centroid),
    });
  }
  if (edges.length === 0) return [];

  const groups = [];
  let cur = { type: edges[0].type, points: [edges[0].p1, edges[0].p2] };

  for (let i = 1; i < edges.length; i++) {
    if (edges[i].type === cur.type) {
      cur.points.push(edges[i].p2);
    } else {
      groups.push(cur);
      cur = { type: edges[i].type, points: [edges[i].p1, edges[i].p2] };
    }
  }
  groups.push(cur);

  // Merge first and last if same type (closed ring)
  if (groups.length > 1 && groups[0].type === groups[groups.length - 1].type) {
    groups[groups.length - 1].points.push(...groups[0].points.slice(1));
    groups.shift();
  }

  return groups;
}

// ── Main hook ────────────────────────────────────────────────────────────

export default function useWallBoundaries() {
  const dispatch = useDispatch();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();

  const computeBoundaries = useCallback(
    async ({ wallAnnotations, boundaryAnnotationTemplate }) => {
      if (!wallAnnotations?.length || !boundaryAnnotationTemplate) {
        throw new Error(
          "wallAnnotations and boundaryAnnotationTemplate are required"
        );
      }

      // Boundary annotations belong to the listing that OWNS the chosen
      // template, not to whatever listing happens to be selected (the wall
      // listing, the free-annotations listing, ...). Otherwise the contour
      // annotations land in the wrong listing and their template's quantity
      // never shows up in that listing's viewer.
      const listingId = boundaryAnnotationTemplate.listingId;
      if (!listingId) {
        throw new Error("boundaryAnnotationTemplate has no listingId");
      }
      const targetListing = await db.listings.get(listingId);

      const imageSize = baseMap?.getImageSize?.();
      const { width, height } = imageSize ?? {};
      if (!width || !height) throw new Error("No image size available");

      const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
      if (!meterByPx || meterByPx <= 0)
        throw new Error("meterByPx is required");

      // ── 1. Resolve wall annotation points ─────────────────────────────
      const allPointIds = [];
      for (const ann of wallAnnotations) {
        if (ann.points)
          for (const p of ann.points) if (p.id) allPointIds.push(p.id);
      }
      const pointRecords = await db.points.bulkGet(allPointIds);
      const pointsById = {};
      for (const pt of pointRecords) if (pt) pointsById[pt.id] = pt;

      // Circles of every S-C-S arc present in the SOURCE walls (px). A contour
      // run whose fitted circle matches one of these came from an arc wall — a
      // robust provenance hint passed to collapseArcsInPolyline so the arc is
      // recovered on the output. maxThicknessPx is the collapse tolerance base.
      const sourceArcCircles = [];
      let maxThicknessPx = 0;

      const walls = [];
      for (const ann of wallAnnotations) {
        if (!ann.points || ann.points.length < 2) continue;
        const pts = [];
        for (const p of ann.points) {
          if (p.x !== undefined && p.y !== undefined) {
            pts.push({ x: p.x, y: p.y, type: p.type });
          } else {
            const rec = pointsById[p.id];
            if (rec)
              pts.push({ x: rec.x * width, y: rec.y * height, type: p.type });
          }
        }
        const isClosed = ann.closeLine === true;
        // Collect source arc circles from the original typed points, before the
        // arcs are flattened by expandArcsInPath below. A closed ring may carry
        // a WRAP arc (its "circle" middle is the last point, closing onto the
        // first) — extractArcCircles is ring-aware and catches it.
        if (isClosed) {
          sourceArcCircles.push(...extractArcCircles(pts));
        } else {
          for (let k = 0; k + 2 < pts.length; k++) {
            if (
              typeOf(pts[k]) !== "circle" &&
              typeOf(pts[k + 1]) === "circle" &&
              typeOf(pts[k + 2]) !== "circle"
            ) {
              const c = circleFromThreePoints(pts[k], pts[k + 1], pts[k + 2]);
              if (c) sourceArcCircles.push(c);
            }
          }
        }
        // Expand S-C-S arcs into straight sample segments before the offset
        // step, so the rest of the pipeline (polygon-clipping union, step
        // removal) continues to see only straight edges.
        const expanded = expandArcsInPath(pts, ARC_SAMPLES, isClosed);
        // Filter degenerate zero-length segments
        const filtered = [expanded[0]];
        for (let i = 1; i < expanded.length; i++) {
          const prev = filtered[filtered.length - 1];
          if (
            Math.abs(expanded[i].x - prev.x) > 0.1 ||
            Math.abs(expanded[i].y - prev.y) > 0.1
          ) {
            filtered.push(expanded[i]);
          }
        }
        if (filtered.length < 2) continue;

        const thicknessPx = (ann.strokeWidth ?? 10) / (meterByPx * 100);
        if (thicknessPx > maxThicknessPx) maxThicknessPx = thicknessPx;
        walls.push({
          points: filtered,
          // Original typed control points (S-C-S arcs intact) — the closed-wall
          // path offsets these directly so arcs stay exact.
          controlPoints: pts,
          halfWidth: thicknessPx / 2,
          side: ann.topologySide ?? "INT",
          closed: isClosed,
        });
      }

      if (walls.length === 0)
        throw new Error("No valid wall annotations found");

      // A closed-line wall is itself a loop: its contour is an annulus
      // (outer + inner closed ring), not an open offset band. Routing it
      // through the open-band pipeline would skip the closing segment and
      // add butt caps, producing a "U" instead of two closed contours.
      const openWalls = walls.filter((w) => !w.closed);
      const closedWalls = walls.filter((w) => w.closed);

      const allGroups = [];

      // ── 2a. Closed-line walls → outer + inner closed contour ──────────
      // Offset the TYPED control ring directly (arc-aware, wrap-aware) instead
      // of the expand→miter-offset→collapse pipeline: an S-C-S arc — including
      // one that wraps past the ring seam — comes out as an exact concentric
      // S-C-S arc, with no re-fitting step to miss it.
      const ringArea = (ring) => {
        const flat = expandArcsInPath(ring, 8, true);
        let sum = 0;
        for (let i = 0; i < flat.length; i++) {
          const a = flat[i];
          const b = flat[(i + 1) % flat.length];
          sum += a.x * b.y - b.x * a.y;
        }
        return Math.abs(sum / 2);
      };
      for (const wall of closedWalls) {
        const ctrl = wall.controlPoints;
        if (!ctrl || ctrl.length < 3) continue;
        const left = offsetControlPolyline(ctrl, wall.halfWidth, true);
        const right = offsetControlPolyline(ctrl, -wall.halfWidth, true);
        if (left.length < 3 || right.length < 3) continue;
        const leftIsOuter = ringArea(left) >= ringArea(right);
        allGroups.push({
          type: "EXT_EXTERIOR",
          typedPoints: leftIsOuter ? left : right,
          closed: true,
        });
        allGroups.push({
          type: "EXT_INTERIOR",
          typedPoints: leftIsOuter ? right : left,
          closed: true,
        });
      }

      // ── 2b. Open walls → rectangle-band union pipeline ────────────────
      if (openWalls.length > 0) {
        const rectRings = [];
        for (const wall of openWalls) {
          const ring = wallToRectRing(wall.points, wall.halfWidth);
          if (ring) rectRings.push(ring);
        }

        if (rectRings.length > 0) {
          // ── 3. Union all wall rectangles ──────────────────────────────
          const polyArgs = rectRings.map((ring) => [[ring]]);
          let merged;
          try {
            merged = polygonClipping.union(...polyArgs);
          } catch (e) {
            console.error(
              "[useWallBoundaries] polygon-clipping union failed:",
              e
            );
            throw new Error("Polygon union failed");
          }

          // ── 4. Compute centroid for EXT side classification ───────────
          let cx = 0,
            cy = 0,
            totalPts = 0;
          for (const w of openWalls) {
            for (const p of w.points) {
              cx += p.x;
              cy += p.y;
              totalPts++;
            }
          }
          const centroid = { x: cx / totalPts, y: cy / totalPts };

          // ── 5. Walk merged boundary, classify, group into polylines ───
          for (const polygon of merged) {
            for (const ring of polygon) {
              const groups = groupEdgesByType(ring, openWalls, centroid);
              allGroups.push(...groups);
            }
          }
        }
      }

      if (allGroups.length === 0)
        throw new Error("No boundary contours produced");

      // ── 6. Create boundary annotations ────────────────────────────────
      const entityTable =
        targetListing?.table ?? targetListing?.entityModel?.defaultTable;

      const SNAP_TOLERANCE = 3;
      const pointIndex = new Map();
      const coordKey = (x, y) =>
        `${Math.round(x / SNAP_TOLERANCE)},${Math.round(y / SNAP_TOLERANCE)}`;
      const getOrCreatePoint = (pxX, pxY) => {
        const key = coordKey(pxX, pxY);
        if (pointIndex.has(key)) return pointIndex.get(key).id;
        const pointId = nanoid();
        pointIndex.set(key, { id: pointId, nx: pxX / width, ny: pxY / height });
        return pointId;
      };

      const allAnnotations = [];
      const allEntities = [];

      for (const group of allGroups) {
        const pointRefs = [];
        const pushRef = (x, y, type) => {
          const id = getOrCreatePoint(x, y);
          const last = pointRefs[pointRefs.length - 1];
          if (last && last.id === id) return; // shared boundary vertex
          pointRefs.push({ id, type });
        };

        if (group.typedPoints) {
          // Closed-wall contour: already an exact typed control ring — push it
          // as-is, no arc re-fitting needed.
          for (const p of group.typedPoints) pushRef(p.x, p.y, typeOf(p));
        } else {
          const pts = group.points;
          if (!pts || pts.length < 2) continue;

          // Recover arcs on the contour: a straight run that lies on a source
          // wall's offset circle is collapsed back into an S-C-S arc, so curved
          // walls produce curved contours instead of faceted segments. Straight
          // contours stay straight (conservative gates inside collapseArcs...).
          const units = collapseArcsInPolyline(
            pts.map(([x, y]) => ({ x, y })),
            {
              thicknessPx: maxThicknessPx,
              sourceArcCircles,
              // A contour arc is always concentric with the wall arc it
              // offsets; require that match so straight junction stubs /
              // corners between merged walls are not mis-fitted as arcs.
              requireSourceMatch: true,
            }
          );

          if (units.length === 0) {
            // Degenerate fallback: keep the previous straight behavior.
            for (const [x, y] of pts) pushRef(x, y, "square");
          } else {
            for (const unit of units) {
              if (unit.kind === "arc") {
                const [a, c, b] = unit.points; // [square, circle, square]
                pushRef(a.x, a.y, "square");
                pushRef(c.x, c.y, "circle");
                pushRef(b.x, b.y, "square");
              } else {
                for (const p of unit.points) pushRef(p.x, p.y, "square");
              }
            }
          }
        }
        if (pointRefs.length < 2) continue;

        let entityId;
        if (entityTable) {
          entityId = nanoid();
          allEntities.push({ id: entityId, listingId, projectId });
        }

        allAnnotations.push({
          id: nanoid(),
          type: "POLYLINE",
          annotationTemplateId: boundaryAnnotationTemplate.id,
          strokeColor: boundaryAnnotationTemplate.strokeColor,
          strokeType: boundaryAnnotationTemplate.strokeType ?? "SOLID",
          strokeOpacity: boundaryAnnotationTemplate.strokeOpacity ?? 1,
          strokeWidth: boundaryAnnotationTemplate.strokeWidth ?? 2,
          strokeWidthUnit: boundaryAnnotationTemplate.strokeWidthUnit ?? "PX",
          closeLine: group.closed === true,
          entityId,
          baseMapId,
          projectId,
          listingId,
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
          boundaryType: group.type,
          points: pointRefs,
        });
      }

      // ── 7. Bulk write ─────────────────────────────────────────────────
      const allPoints = [];
      for (const entry of pointIndex.values()) {
        allPoints.push({
          id: entry.id,
          x: entry.nx,
          y: entry.ny,
          baseMapId,
          projectId,
          listingId,
          forMarker: false,
        });
      }

      const tables = [db.points, db.annotations];
      if (entityTable && allEntities.length > 0) tables.push(db[entityTable]);

      await db.transaction("rw", tables, async () => {
        if (allPoints.length > 0) await db.points.bulkAdd(allPoints);
        if (entityTable && allEntities.length > 0)
          await db[entityTable].bulkAdd(allEntities);
        if (allAnnotations.length > 0)
          await db.annotations.bulkAdd(allAnnotations);
      });

      dispatch(triggerAnnotationsUpdate());
      if (entityTable) dispatch(triggerEntitiesTableUpdate(entityTable));

      console.log(
        `[useWallBoundaries] Created ${allAnnotations.length} boundary annotations`
      );
      return { count: allAnnotations.length };
    },
    [baseMap, baseMapId, projectId, activeLayerId, dispatch]
  );

  return computeBoundaries;
}
