import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

// Match epsilon for reusing an existing db.points record on the same
// baseMap (in normalized [0..1] space). 5e-4 ≈ 0.5 mm at a 1 m image.
export const POINT_REUSE_EPS = 5e-4;

// Persist `db.points` records and return the {id} references for an
// annotation. If a vertex's normalized (x, y) on the host baseMap matches
// an existing db.points within `POINT_REUSE_EPS`, that point is REUSED
// instead of a new one being created — so two faces that share a corner
// also share the underlying db.points and stay connected when the user
// later moves either one.
export default async function insertOrReusePoints({
  projectedPoints,
  baseMap,
  projectId,
  listingId,
}) {
  const existing = await db.points
    .where("baseMapId")
    .equals(baseMap.id)
    .toArray();
  const liveExisting = existing.filter((p) => !p.deletedAt);

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
      }
      pointRefs.push({
        id: matchId,
        type: "square",
        offsetBottom: p.offsetBottom ?? 0,
        offsetTop: p.offsetTop ?? 0,
      });
    }
  });
  return pointRefs;
}
