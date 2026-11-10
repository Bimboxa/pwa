import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import getPathChunksInRegion from "Features/surfaceCut/utils/getPathChunksInRegion";

// Plan tolerance (m), like the surface cut: a trace end closer than this to
// the outline is on it.
const PLAN_TOL_M = 1e-2;

// « Couper une surface » with « Ne pas découper »: the trace is stored as an
// OPEN height cut (annotation.heightCuts, closeLine: false) on every surface
// it runs across — the surfaces are not split, the faces the trace delimits
// are computed at read time (computeHeightFaces).
//
// hosts: resolved POLYGON annotations (pixel `points` / `cuts`) ; pathPx: the
// trace [{x, y}] in pixels ; imageSize: { width, height } ; meterByPx.
// One Ctrl+Z undoes the trace on every surface.
//
// Returns { cutCount, reason } — reason: "NO_CROSSING" | "SELF_INTERSECTING"
// when nothing was written, null otherwise.
export default async function addHeightCutLineService({
  hosts,
  pathPx,
  imageSize,
  meterByPx,
  projectId,
}) {
  const { width, height } = imageSize ?? {};
  if (!width || !height || !(pathPx?.length >= 2)) {
    return { cutCount: 0, reason: "NO_CROSSING" };
  }
  const k = meterByPx > 0 ? meterByPx : 1;
  const toMeters = (p) => ({ x: p.x * k, y: p.y * k });
  const path = pathPx.map(toMeters);

  let reason = "NO_CROSSING";
  const plans = [];
  for (const host of hosts ?? []) {
    if (host?.type !== "POLYGON" || host.isMesh3d || !(host.points?.length >= 3))
      continue;
    // Like the surface cut: the trace is drawn in the plan frame, a rotated
    // surface does not read it there.
    if (Number(host.rotation)) {
      reason = "ROTATED";
      continue;
    }
    const loops = [host.points, ...(host.cuts ?? []).map((cut) => cut.points)]
      .filter((ring) => ring?.length >= 3)
      .map((ring) => expandArcsInPath(ring, 6, true).map(toMeters));
    const result = getPathChunksInRegion(loops, path, {
      tolerance: PLAN_TOL_M,
      extendEnds: true,
    });
    if (result.error === "SELF_INTERSECTING") reason = "SELF_INTERSECTING";
    if (!result.chunks?.length) continue;
    // One chunk: the trace is the part inside the surface. Several (a trace
    // leaving and re-entering the surface): the whole prolonged trace.
    const trace = result.chunks.length === 1 ? result.chunks[0] : result.path;
    plans.push({ host, trace });
  }
  if (!plans.length) return { cutCount: 0, reason };

  await withUndoGroup(async () => {
    for (const { host, trace } of plans) {
      const row = await db.annotations.get(host.id);
      if (!row || row.deletedAt) continue;
      const pointRows = trace.map((p) => ({
        id: nanoid(),
        x: p.x / k / width,
        y: p.y / k / height,
        projectId: row.projectId ?? projectId,
        baseMapId: row.baseMapId,
        listingId: row.listingId,
      }));
      const heightCut = {
        id: nanoid(),
        closeLine: false,
        points: pointRows.map((p) => ({ pointId: p.id })),
      };
      await db.transaction("rw", db.points, db.annotations, async () => {
        await db.points.bulkAdd(pointRows);
        await db.annotations.update(row.id, {
          heightCuts: [...(row.heightCuts ?? []), heightCut],
        });
      });
    }
  });
  return { cutCount: plans.length, reason: null };
}
