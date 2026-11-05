import db from "App/db/db";
import { getBaseMapLinkWorldLength } from "Features/baseMaps/js/computeBaseMapLinkCloneGeometry";

import getHydratedBaseMap from "./getHydratedBaseMap";
import { isBaseMapLinkSource } from "../utils/baseMapLinkPredicates";

// True length (m) of a section mark, read straight from Dexie: the horizontal
// distance between its two points on its plan. Null when the mark is gone or
// its plan has no scale — the mark then cannot be located on an elevation.
export default async function getBaseMapLinkWorldLengthService(linkId) {
  if (!linkId) return null;
  const link = await db.annotations.get(linkId);
  if (!link || link.deletedAt || !isBaseMapLinkSource(link)) return null;
  if (link.points?.length !== 2) return null;

  const [p1, p2] = await db.points.bulkGet([
    link.points[0].id,
    link.points[1].id,
  ]);
  if (!p1 || !p2) return null;

  const planBaseMap = await getHydratedBaseMap(link.baseMapId);
  if (!planBaseMap) return null;

  return getBaseMapLinkWorldLength({
    planBaseMap,
    planNorm: { p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y } },
  });
}
