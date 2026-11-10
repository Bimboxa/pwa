import db from "App/db/db";

import { testIsWhitePageImage } from "../utils/createWhitePageImage";
import {
  getWhitePageMeterByPx,
  getWhitePageScale,
} from "../utils/whitePageScale";

const PX_TOLERANCE = 1;

// The print zone of a blank page is the whole sheet: it follows the page
// scale. A zone the user moved / resized is left alone.
function isWholePageZone(zone, imageSize) {
  if (!zone || !imageSize) return false;
  return (
    Math.abs(zone.x ?? 0) <= PX_TOLERANCE &&
    Math.abs(zone.y ?? 0) <= PX_TOLERANCE &&
    Math.abs((zone.width ?? 0) - imageSize.width) <= PX_TOLERANCE &&
    Math.abs((zone.height ?? 0) - imageSize.height) <= PX_TOLERANCE
  );
}

/**
 * Changes the 1:N scale of a WHITE PAGE base map (no image file: the sheet
 * keeps its pixel size, only its resolution changes — see
 * docs/baseMaps/WHITE_PAGE_BASE_MAPS.md). Points are stored normalized: every
 * annotation of the page keeps its place on the sheet and takes the new real
 * size, so callers re-place what must keep its dimensions.
 *
 * No-op (changed: false) on a base map that is not a white page, or already
 * at that scale. The caller dispatches the base maps / annotations refresh.
 *
 * @param {object} args
 * @param {string} args.baseMapId
 * @param {number} args.scale the N of 1:N
 * @returns {Promise<{changed: boolean, meterByPx: number|null}>}
 */
export default async function setWhitePageScaleService({ baseMapId, scale }) {
  const meterByPx = getWhitePageMeterByPx(scale);
  if (!baseMapId || !meterByPx) return { changed: false, meterByPx: null };

  const record = await db.baseMaps.get(baseMapId);
  if (!record || record.deletedAt || !testIsWhitePageImage(record.image)) {
    return { changed: false, meterByPx: record?.meterByPx ?? null };
  }
  if (getWhitePageScale(record.meterByPx) === getWhitePageScale(meterByPx)) {
    return { changed: false, meterByPx: record.meterByPx };
  }

  const changes = { meterByPx };
  if (isWholePageZone(record.printZone, record.image?.imageSize)) {
    changes.printZone = { ...record.printZone, scale };
  }
  await db.baseMaps.update(baseMapId, changes);
  return { changed: true, meterByPx };
}
