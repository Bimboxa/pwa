import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import computeOpeningEndpointsFromHost from "Features/mapEditor/utils/computeOpeningEndpointsFromHost";
import computeOpeningSegmentPlacement from "Features/mapEditor/utils/computeOpeningSegmentPlacement";
import deriveOpeningContourAnchor from "Features/mapEditor/utils/deriveOpeningContourAnchor";
import updateAnnotationOpeningAnchor from "Features/annotations/services/updateAnnotationOpeningAnchor";
import applyOpeningOnPolygon from "Features/annotations/utils/applyOpeningOnPolygon";
import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import resolvePoints from "Features/annotations/utils/resolvePoints";

// Commit-time reflow of glued openings after their host wall geometry changed
// (vertex drag, whole-annotation move, segment split...). Recomputes each
// opening's 2 own db.points rows from the stored anchor (fixed distance in
// meters from the reference vertex) and refreshes the host carve (inner-ring
// cut coords, or contour notch re-carve).
//
// Selection: rows whose hostAnnotationId ∈ hostIds, or whose anchor point ids
// intersect movedPointIds. When the stored anchor ids are no longer adjacent
// in the host contour (host split / carved between them), the opening is
// re-anchored by projecting its current center onto the host contour.

async function resolveAnnotationPx(ann, imageSize) {
  const pointIds = new Set();
  for (const p of ann.points ?? []) if (p?.id) pointIds.add(p.id);
  const rows = await db.points.bulkGet([...pointIds]);
  const pointsIndex = {};
  for (const r of rows) if (r) pointsIndex[r.id] = r;
  return resolvePoints({ points: ann.points, pointsIndex, imageSize });
}

// Are the two anchor ids adjacent in the host contour (allowing one arc
// control point between them)?
function anchorIsValid(hostPointsRefs, rel, closed) {
  const ids = (hostPointsRefs ?? []).map((p) => p?.id);
  const n = ids.length;
  if (n < 2) return false;
  const i = ids.indexOf(rel.hostSegmentStartPointId);
  const j = ids.indexOf(rel.hostSegmentEndPointId);
  if (i === -1 || j === -1) return false;
  const limit = closed ? n : n - 1;
  const nextOf = (k, step) => (k + step + n) % n;
  // direct adjacency (either direction)
  if (i < limit && nextOf(i, 1) === j) return true;
  if (j < limit && nextOf(j, 1) === i) return true;
  // arc: start — control — end
  if (rel.hostArcControlPointId) {
    if (
      nextOf(i, 1) < n &&
      ids[nextOf(i, 1)] === rel.hostArcControlPointId &&
      nextOf(i, 2) === j
    )
      return true;
    if (
      nextOf(j, 1) < n &&
      ids[nextOf(j, 1)] === rel.hostArcControlPointId &&
      nextOf(j, 2) === i
    )
      return true;
  }
  return false;
}

export default async function reflowOpeningsForHost({
  movedPointIds = [],
  hostIds = [],
  projectId,
  imageSize,
  meterByPx,
}) {
  const { width, height } = imageSize ?? {};
  if (!projectId || !width || !height || !(meterByPx > 0)) return;

  const allRels = await db.relAnnotationOpenings
    .where("projectId")
    .equals(projectId)
    .toArray();

  const movedSet = new Set(movedPointIds);
  const hostSet = new Set(hostIds);

  const rels = allRels.filter((r) => {
    if (r.deletedAt) return false;
    if (hostSet.has(r.hostAnnotationId)) return true;
    return (
      movedSet.has(r.hostSegmentStartPointId) ||
      movedSet.has(r.hostSegmentEndPointId) ||
      (r.hostArcControlPointId && movedSet.has(r.hostArcControlPointId))
    );
  });
  if (rels.length === 0) return;

  for (const rel of rels) {
    const [opening, host] = await Promise.all([
      db.annotations.get(rel.openingAnnotationId),
      db.annotations.get(rel.hostAnnotationId),
    ]);
    if (!opening || opening.deletedAt || opening.points?.length !== 2) continue;
    if (!host || host.deletedAt || !host.points?.length) continue;

    const widthM = Number(opening.width);
    if (!(widthM > 0)) continue;
    const openingLengthPx = widthM / meterByPx;

    const hostPx = await resolveAnnotationPx(host, imageSize);
    const closed = Boolean(host.closeLine || host.type === "POLYGON");
    const hostPxById = {};
    hostPx.forEach((p) => {
      if (p?.id) hostPxById[p.id] = p;
    });

    let anchor = {
      startId: rel.hostSegmentStartPointId,
      endId: rel.hostSegmentEndPointId,
      arcControlId: rel.hostArcControlPointId ?? null,
      distancePx: (Number(rel.hostDistanceM) || 0) / meterByPx,
    };

    // Re-anchor when the stored segment no longer exists as-is in the host
    // contour (split / carve re-minted ids between the two vertices).
    if (!anchorIsValid(host.points, rel, closed)) {
      const openingPx = await resolveAnnotationPx(opening, imageSize);
      if (openingPx?.length !== 2) continue;
      const center = {
        x: (openingPx[0].x + openingPx[1].x) / 2,
        y: (openingPx[0].y + openingPx[1].y) / 2,
      };
      const resolvedHost = { ...host, points: hostPx, isOpening: false };
      const placement = computeOpeningSegmentPlacement({
        cursorPx: center,
        annotations: [resolvedHost],
        openingLengthPx,
        hoverThresholdPx: Infinity,
        vertexSnapPx: 0,
        anchorEnd: "start",
      });
      if (!placement) continue;
      anchor = {
        startId: placement.segStartId,
        endId: placement.segEndId,
        arcControlId: placement.arcControlId ?? null,
        distancePx: placement.hostDistancePx,
      };
      await updateAnnotationOpeningAnchor(rel.id, {
        hostSegmentStartPointId: anchor.startId,
        hostSegmentEndPointId: anchor.endId,
        hostArcControlPointId: anchor.arcControlId,
        hostDistanceM: anchor.distancePx * meterByPx,
      });
    }

    const segStartPx = hostPxById[anchor.startId];
    const segEndPx = hostPxById[anchor.endId];
    if (!segStartPx || !segEndPx) continue;
    const arcControlPx = anchor.arcControlId
      ? hostPxById[anchor.arcControlId]
      : null;

    const res = computeOpeningEndpointsFromHost({
      segStartPx,
      segEndPx,
      hostDistancePx: anchor.distancePx,
      openingLengthPx,
      arcControlPx,
    });

    // 1. Reposition the opening's own 2 point rows.
    const [ref1, ref2] = opening.points;
    await db.transaction("rw", db.points, async () => {
      await db.points.update(ref1.id, {
        x: res.p1.x / width,
        y: res.p1.y / height,
      });
      await db.points.update(ref2.id, {
        x: res.p2.x / width,
        y: res.p2.y / height,
      });
    });

    // Persist the clamped distance only when the opening was actually pushed
    // (segment became too short on the reference side).
    if (res.fits && Math.abs(res.hostDistancePx - anchor.distancePx) > 0.5) {
      await updateAnnotationOpeningAnchor(rel.id, {
        hostDistanceM: res.hostDistancePx * meterByPx,
      });
    }

    // 2. Refresh the host carve.
    const carve = rel.carve ?? { mode: "NONE" };
    if (carve.mode === "NONE" || host.type !== "POLYGON") continue;

    const bandPolys = getAnnotationAsPolygons(
      {
        type: "POLYLINE",
        points: [res.p1, res.p2],
        strokeWidth: opening.strokeWidth,
        strokeWidthUnit: opening.strokeWidthUnit,
      },
      { meterByPx }
    );
    const bandPx = bandPolys?.[0]?.points?.map((p) => ({ x: p.x, y: p.y }));
    if (!bandPx || bandPx.length < 3) continue;

    if (carve.mode === "CUT") {
      // Inner-ring cut: move the ring's own point rows onto the new band.
      const cut = (host.cuts ?? []).find((c) => c.id === carve.cutId);
      if (!cut) continue;
      if (cut.points?.length === bandPx.length) {
        await db.transaction("rw", db.points, async () => {
          await Promise.all(
            cut.points.map((refPt, i) =>
              db.points.update(refPt.id, {
                x: bandPx[i].x / width,
                y: bandPx[i].y / height,
              })
            )
          );
        });
      } else {
        // Ring shape changed — rebuild the refs with fresh rows.
        const newRows = [];
        const newRefs = bandPx.map((p) => {
          const id = nanoid();
          newRows.push({
            id,
            x: p.x / width,
            y: p.y / height,
            baseMapId: host.baseMapId,
            projectId,
            listingId: host.listingId,
          });
          return { id };
        });
        await db.transaction("rw", db.points, db.annotations, async () => {
          await db.points.bulkAdd(newRows);
          const cuts = (host.cuts ?? []).map((c) =>
            c.id === carve.cutId ? { ...c, points: newRefs } : c
          );
          await db.annotations.update(host.id, { cuts });
        });
      }
      continue;
    }

    if (carve.mode === "CONTOUR") {
      // Restore the pre-carve side by dropping the notch points, then re-carve
      // with the new band. NOTE: applyOpeningOnPolygon re-mints every ring id,
      // so other openings anchored on this host will re-anchor by projection
      // on their next reflow (anchorIsValid fails).
      const notchSet = new Set(carve.notchPointIds ?? []);
      const restoredRefs = (host.points ?? []).filter(
        (p) => !notchSet.has(p?.id)
      );
      if (restoredRefs.length < 3) continue;
      const restoredHost = { ...host, points: restoredRefs };
      const contourResult = await applyOpeningOnPolygon({
        host: restoredHost,
        openingPointsPx: bandPx,
        imageSize,
        baseMapId: host.baseMapId,
        projectId,
        listingId: host.listingId,
      });
      if (contourResult?.handled && contourResult.updatedAnnotation) {
        await db.annotations.update(host.id, {
          points: contourResult.updatedAnnotation.points,
          cuts: contourResult.updatedAnnotation.cuts,
        });
        const derived = deriveOpeningContourAnchor({
          ringRefs: contourResult.updatedAnnotation.points,
          pxById: contourResult.newPointsPxById,
          segStartPx,
          segEndPx,
          bandPx,
        });
        await updateAnnotationOpeningAnchor(rel.id, {
          ...(derived.startId && {
            hostSegmentStartPointId: derived.startId,
          }),
          ...(derived.endId && { hostSegmentEndPointId: derived.endId }),
          carve: { mode: "CONTOUR", notchPointIds: derived.notchPointIds },
        });
      } else if (contourResult && !contourResult.handled) {
        // Band now strictly inside the restored contour → write the restored
        // contour and switch to an inner-ring cut.
        const cutId = nanoid();
        const newRows = [];
        const newRefs = bandPx.map((p) => {
          const id = nanoid();
          newRows.push({
            id,
            x: p.x / width,
            y: p.y / height,
            baseMapId: host.baseMapId,
            projectId,
            listingId: host.listingId,
          });
          return { id };
        });
        await db.transaction("rw", db.points, db.annotations, async () => {
          await db.points.bulkAdd(newRows);
          await db.annotations.update(host.id, {
            points: restoredRefs,
            cuts: [...(host.cuts ?? []), { id: cutId, points: newRefs }],
          });
        });
        await updateAnnotationOpeningAnchor(rel.id, {
          carve: { mode: "CUT", cutId },
        });
      }
    }
  }
}
