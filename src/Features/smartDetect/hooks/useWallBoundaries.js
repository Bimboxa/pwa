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
  lineLineIntersection,
} from "Features/geometry/utils/wallToRectRing";

import db from "App/db/db";

/**
 * Find the thickness of the nearest wall to a point.
 */
function nearestWallThickness(px, py, walls) {
  let bestDist = Infinity;
  let bestThick = 0;
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
        Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq)
      );
      const dist = Math.sqrt(
        (px - (a.x + t * dx)) ** 2 + (py - (a.y + t * dy)) ** 2
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestThick = wall.halfWidth * 2;
      }
    }
  }
  return bestThick;
}

/**
 * Remove step artifacts from a polygon ring produced by polygon-clipping union.
 *
 * 1. Mark each segment as "step" (shorter than local wall thickness) or "real".
 * 2. Find chains of consecutive step segments.
 * 3. For each chain, intersect the real segment BEFORE with the real segment AFTER.
 * 4. Replace the entire chain with the single intersection point.
 */
function removeSteps(ring, walls) {
  if (ring.length < 5) return ring;

  const realN = ring.length - 1; // closed ring: last === first

  // 1. Classify each segment as step or real
  const isStep = new Array(realN).fill(false);
  for (let i = 0; i < realN; i++) {
    const a = ring[i],
      b = ring[(i + 1) % realN];
    const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    if (len === 0) {
      isStep[i] = true;
      continue;
    }
    const midX = (a[0] + b[0]) / 2,
      midY = (a[1] + b[1]) / 2;
    const localThick = nearestWallThickness(midX, midY, walls);
    if (len < localThick * 1.2) isStep[i] = true;
  }

  // 2. Find chains of consecutive step segments
  // A chain starting at segment index s and ending at segment index e means
  // segments s, s+1, ..., e are all steps.
  // The real segment before the chain is segment (s-1), going from point (s-1) to point s.
  // The real segment after the chain is segment (e+1), going from point (e+1) to point (e+2).
  // We replace points s+1 through e+1 (the interior points of the chain) with a single intersection point.

  const keep = new Array(ring.length).fill(true);
  const replacements = []; // { replaceIdx, point }

  let i = 0;
  while (i < realN) {
    if (!isStep[i]) {
      i++;
      continue;
    }

    // Find the chain: consecutive step segments starting at i
    let chainEnd = i;
    while (chainEnd < realN && isStep[chainEnd % realN]) chainEnd++;
    // Chain covers segments i, i+1, ..., chainEnd-1
    // Points involved: i, i+1, ..., chainEnd

    // Real segment BEFORE chain: segment (i-1), from point (i-1) to point i
    const prevIdx = (i - 1 + realN) % realN;
    const prevStart = ring[prevIdx];
    const prevEnd = ring[i % realN];
    const v1 = { x: prevEnd[0] - prevStart[0], y: prevEnd[1] - prevStart[1] };

    // Real segment AFTER chain: segment chainEnd, from point chainEnd to point chainEnd+1
    const afterStart = ring[chainEnd % realN];
    const afterEnd = ring[(chainEnd + 1) % realN];
    const v2 = {
      x: afterEnd[0] - afterStart[0],
      y: afterEnd[1] - afterStart[1],
    };

    // Skip if either direction is zero
    if ((v1.x === 0 && v1.y === 0) || (v2.x === 0 && v2.y === 0)) {
      i = chainEnd + 1;
      continue;
    }

    // Intersect line(prevStart, v1) with line(afterStart, v2)
    const inter = lineLineIntersection(
      { x: prevStart[0], y: prevStart[1] },
      v1,
      { x: afterStart[0], y: afterStart[1] },
      v2
    );

    if (inter) {
      // Sanity: intersection should be near the chain
      const chainMidX = (prevEnd[0] + afterStart[0]) / 2;
      const chainMidY = (prevEnd[1] + afterStart[1]) / 2;
      const dInter = Math.sqrt(
        (inter.x - chainMidX) ** 2 + (inter.y - chainMidY) ** 2
      );
      const localThick = nearestWallThickness(chainMidX, chainMidY, walls);

      if (dInter < localThick * 3) {
        // Mark all interior chain points for removal, keep first chain point as intersection
        const firstChainPt = i % realN;
        replacements.push({ idx: firstChainPt, point: [inter.x, inter.y] });

        // Remove points (i+1) through chainEnd (inclusive) — all chain vertices after the replacement
        for (let k = i + 1; k <= chainEnd; k++) {
          keep[k % realN] = false;
        }
      }
    }

    i = chainEnd + 1;
  }

  // Apply replacements
  const result = [...ring];
  for (const r of replacements) {
    result[r.idx] = r.point;
  }

  // Filter removed points
  const filtered = result.filter((_, idx) => keep[idx]);

  // Re-close the ring
  if (filtered.length >= 2) {
    filtered[filtered.length - 1] = [...filtered[0]];
  }

  return filtered;
}

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
        });
      }

      if (walls.length === 0)
        throw new Error("No valid wall annotations found");

      // ── 2. Convert each wall to a rectangle polygon ───────────────────
      const rectRings = [];
      for (const wall of walls) {
        const ring = wallToRectRing(wall.points, wall.halfWidth);
        if (ring) rectRings.push(ring);
      }

      if (rectRings.length === 0) throw new Error("No valid wall rectangles");

      // ── 3. Union all wall rectangles ──────────────────────────────────
      const polyArgs = rectRings.map((ring) => [[ring]]);
      let merged;
      try {
        merged = polygonClipping.union(...polyArgs);
      } catch (e) {
        console.error("[useWallBoundaries] polygon-clipping union failed:", e);
        throw new Error("Polygon union failed");
      }

      // ── 3b. Remove step artifacts at L-junction corners ────────────────
      for (const polygon of merged) {
        for (let r = 0; r < polygon.length; r++) {
          polygon[r] = removeSteps(polygon[r], walls);
        }
      }

      // ── 4. Compute centroid for EXT side classification ───────────────
      let cx = 0,
        cy = 0,
        totalPts = 0;
      for (const w of walls) {
        for (const p of w.points) {
          cx += p.x;
          cy += p.y;
          totalPts++;
        }
      }
      const centroid = { x: cx / totalPts, y: cy / totalPts };

      // ── 5. Walk merged boundary, classify edges, group into polylines ─
      const allGroups = [];

      for (const polygon of merged) {
        for (const ring of polygon) {
          const groups = groupEdgesByType(ring, walls, centroid);
          allGroups.push(...groups);
        }
      }

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
          closeLine: false,
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
