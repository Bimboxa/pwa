import { useCallback } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";
import polygonClipping from "polygon-clipping";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import wallToRectRing, {
  segNormal,
  wallToHollowRings,
} from "Features/geometry/utils/wallToRectRing";

import db from "App/db/db";

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
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();
  const { value: selectedListing } = useSelectedListing();

  const computeBoundaries = useCallback(
    async ({ wallAnnotations, boundaryAnnotationTemplate }) => {
      if (!wallAnnotations?.length || !boundaryAnnotationTemplate) {
        throw new Error(
          "wallAnnotations and boundaryAnnotationTemplate are required"
        );
      }

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
        // Expand S-C-S arcs into straight sample segments before the offset
        // step, so the rest of the pipeline (polygon-clipping union, step
        // removal) continues to see only straight edges.
        const expanded = expandArcsInPath(pts, 6);
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
        walls.push({
          points: filtered,
          halfWidth: thicknessPx / 2,
          side: ann.topologySide ?? "INT",
          closed: ann.closeLine === true,
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
      for (const wall of closedWalls) {
        const rings = wallToHollowRings(wall.points, wall.halfWidth);
        if (!rings) continue;
        allGroups.push({
          type: "EXT_EXTERIOR",
          points: rings.outer.map((p) => [p.x, p.y]),
          closed: true,
        });
        allGroups.push({
          type: "EXT_INTERIOR",
          points: rings.inner.map((p) => [p.x, p.y]),
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
        selectedListing?.table ?? selectedListing?.entityModel?.defaultTable;

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
        const pts = group.points;
        if (!pts || pts.length < 2) continue;

        let entityId;
        if (entityTable) {
          entityId = nanoid();
          allEntities.push({ id: entityId, listingId, projectId });
        }

        const pointRefs = pts.map((coord) => ({
          id: getOrCreatePoint(coord[0], coord[1]),
          type: "square",
        }));

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
    [
      baseMap,
      baseMapId,
      projectId,
      listingId,
      activeLayerId,
      selectedListing,
      dispatch,
    ]
  );

  return computeBoundaries;
}
