import db from "App/db/db";

import { getBaseMapReferenceSize } from "Features/baseMaps/js/getBaseMapRenderScale";

import resolvePoints from "./resolvePoints";

// Resolve the points of raw db.annotations rows against THEIR OWN base map's
// reference frame (pixels): each row's point refs are fetched from db.points
// and denormalized with its base map's reference size. Returns a Map
// id → resolved row; a row whose base map is unknown is dropped.
//
// Shared by useAnnotationsV2 (cross-base-map subtraction targets, revolution
// footprints — rows hosted by other base maps than the queried one) and by
// the headless « soustraire au contact » detection.
//
// `baseMapById` holds BaseMap instances or plain db.baseMaps records.
//
// `options.withCuts` also resolves the holes (`cuts[].points`, degenerate
// holes dropped) and the inner Steiner points (`innerPoints`), for callers
// that build the row as a 3D HOST (a hole changes the solid).
export default async function resolveRowsAgainstOwnBaseMap(
  rows,
  baseMapById,
  options
) {
  const withCuts = Boolean(options?.withCuts);
  const refIds = [];
  for (const r of rows) {
    for (const p of r.points ?? []) if (p?.id) refIds.push(p.id);
    if (r.point?.id) refIds.push(r.point.id);
    if (!withCuts) continue;
    for (const cut of r.cuts ?? [])
      for (const p of cut?.points ?? []) if (p?.id) refIds.push(p.id);
    for (const p of r.innerPoints ?? []) if (p?.id) refIds.push(p.id);
  }
  const ptRows = refIds.length ? await db.points.bulkGet(refIds) : [];
  const ptIndex = {};
  for (const p of ptRows) if (p?.id && !p.deletedAt) ptIndex[p.id] = p;

  const byId = new Map();
  for (const r of rows) {
    const bm = baseMapById[r.baseMapId];
    const imageSize = bm ? getBaseMapReferenceSize(bm) : null;
    if (!imageSize) continue;
    byId.set(r.id, {
      ...r,
      points: r.points
        ? resolvePoints({
            points: r.points,
            pointsIndex: ptIndex,
            imageSize,
          })
        : r.points,
      point: r.point
        ? resolvePoints({
            points: [r.point],
            pointsIndex: ptIndex,
            imageSize,
          })?.[0]
        : r.point,
      ...(withCuts && Array.isArray(r.cuts)
        ? {
            cuts: r.cuts
              .map((cut) => ({
                ...cut,
                points: resolvePoints({
                  points: cut?.points ?? [],
                  pointsIndex: ptIndex,
                  imageSize,
                }).filter(
                  (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
                ),
              }))
              .filter((cut) => cut.points.length >= 3),
          }
        : {}),
      ...(withCuts && Array.isArray(r.innerPoints)
        ? {
            innerPoints: resolvePoints({
              points: r.innerPoints,
              pointsIndex: ptIndex,
              imageSize,
            }).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)),
          }
        : {}),
    });
  }
  return byId;
}
