import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

// Match epsilon for reusing an existing db.points record on the same
// baseMap (in normalized [0..1] space). 5e-4 ≈ 0.5 mm at a 1 m image.
export const POINT_REUSE_EPS = 5e-4;

// Persist `db.points` records and return the {id} references for an
// annotation. A projected point's `type` ("circle" = arc point, see
// arcSampling) rides on the ref — the type lives on annotation.points, never
// on db.points (2D parity, useHandleCommitDrawing).
// If a vertex's normalized (x, y) on the host baseMap matches
// an existing db.points within `POINT_REUSE_EPS`, that point is REUSED
// instead of a new one being created — so two faces that share a corner
// also share the underlying db.points and stay connected when the user
// later moves either one.
//
// The points of a mesh annotation (isMesh3d) are never reused: they are only
// the plan projection of its mesh, locked in 2D (usePointDrag) — sharing one
// would lock the new annotation's vertex too.
//
// reuseExistingPoints: false mints new points for every vertex instead of
// reusing the plan's (a duplicate meant to be independent of its source);
// vertices of the same call still share one point (a riser keeps its two
// refs on the same id).
//
// batchPointIds (a Set, mutated): the points minted by the previous calls of
// one batch (« Dupliquer » on several faces / edges). They stay reusable when
// reuseExistingPoints is false, and the points minted here join them — two
// neighbor parts of the batch share their corner without sharing the
// source's points.
export default async function insertOrReusePoints({
  projectedPoints,
  baseMap,
  projectId,
  listingId,
  reuseExistingPoints = true,
  batchPointIds = null,
}) {
  const [existing, hostAnnotations] = await Promise.all([
    db.points.where("baseMapId").equals(baseMap.id).toArray(),
    db.annotations.where("baseMapId").equals(baseMap.id).toArray(),
  ]);
  const meshPointIds = new Set();
  for (const annotation of hostAnnotations) {
    if (!annotation.isMesh3d || annotation.deletedAt) continue;
    const refs = [
      ...(annotation.points ?? []),
      ...(annotation.cuts ?? []).flatMap((cut) => cut?.points ?? []),
    ];
    for (const ref of refs) {
      if (ref?.id) meshPointIds.add(ref.id);
    }
  }
  const liveExisting = reuseExistingPoints
    ? existing.filter((p) => !p.deletedAt && !meshPointIds.has(p.id))
    : batchPointIds
      ? existing.filter((p) => !p.deletedAt && batchPointIds.has(p.id))
      : [];

  const pointRefs = [];
  await db.transaction("rw", db.points, async () => {
    for (const p of projectedPoints) {
      let matchId = null;
      for (const ep of liveExisting) {
        if (
          Math.abs(ep.x - p.x) < POINT_REUSE_EPS &&
          Math.abs(ep.y - p.y) < POINT_REUSE_EPS
        ) {
          matchId = ep.id;
          break;
        }
      }
      if (!matchId) {
        matchId = nanoid();
        await db.points.add({
          id: matchId,
          x: p.x,
          y: p.y,
          projectId,
          baseMapId: baseMap.id,
          listingId,
        });
        liveExisting.push({ id: matchId, x: p.x, y: p.y });
        batchPointIds?.add(matchId);
      }
      pointRefs.push({
        id: matchId,
        type: p.type === "circle" ? "circle" : "square",
        offsetBottom: p.offsetBottom ?? 0,
        offsetTop: p.offsetTop ?? 0,
      });
    }
  });
  return pointRefs;
}
