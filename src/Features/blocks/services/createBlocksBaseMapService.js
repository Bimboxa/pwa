import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { PX_PER_MM } from "Features/baseMaps/utils/getBlankBaseMapGeometry";
import { getWhitePageImageField } from "Features/baseMaps/utils/createWhitePageImage";

import {
  BLOCKS_BASE_MAP_SCALE,
  BLOCKS_BASE_MAP_SIDE_M,
} from "../utils/blockTypes";
import getNextBlocksBaseMapName from "../utils/getNextBlocksBaseMapName";

// Creates a blocks base map: a square white page (no file in db.files, see
// docs/baseMaps/WHITE_PAGE_BASE_MAPS.md) tagged `isBlocksBaseMap`, belonging
// to no base map listing (listingId null, like a detail base map) so that no
// folder-driven UI lists it. Project-shared, like every base map.
// `sideM` / `scale` size the page (defaults: 20 m at 1:50) — a page meant for
// one small block (a 50 cm podium…) reads better as a few meters at 1:10.
// Returns the db.baseMaps record.
export default async function createBlocksBaseMapService({
  projectId,
  name,
  sideM,
  scale,
}) {
  if (!projectId) throw new Error("projectId is required");

  const pageSideM = sideM > 0 ? sideM : BLOCKS_BASE_MAP_SIDE_M;
  const pageScale = scale > 0 ? scale : BLOCKS_BASE_MAP_SCALE;
  const side = Math.round(((pageSideM * 1000) / pageScale) * PX_PER_MM);
  const meterByPx = pageScale / (PX_PER_MM * 1000);
  const image = getWhitePageImageField({ width: side, height: side });

  const existing = (
    await db.baseMaps.where("projectId").equals(projectId).toArray()
  ).filter((r) => r.isBlocksBaseMap && !r.deletedAt);

  const record = {
    id: nanoid(),
    projectId,
    listingId: null,
    isBlocksBaseMap: true,
    name: name?.trim() || getNextBlocksBaseMapName(existing.map((r) => r.name)),
    whitePage: {},
    image,
    refWidth: side,
    refHeight: side,
    meterByPx,
  };

  await db.transaction("rw", [db.baseMaps, db.baseMapVersions], async () => {
    await db.baseMaps.add(record);
    await db.baseMapVersions.put({
      id: nanoid(),
      baseMapId: record.id,
      projectId,
      listingId: null,
      isBlocksBaseMap: true,
      label: "Image d'origine",
      fractionalIndex: "a0",
      isActive: true,
      image,
      transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    });
  });

  return record;
}
