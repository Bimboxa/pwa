import composeBaseMapsGridSheets from "Features/baseMapsGrid/utils/composeBaseMapsGridSheets";
import getBaseMapRenderScale, {
  getBaseMapReferenceSize,
} from "Features/baseMaps/js/getBaseMapRenderScale";

// Sheets of the 3D base maps grid: the base maps of a listing, arranged like
// in the 2D grid (same paper sheets, same positions in paper points), with
// what the 3D poses need (reference frame size, scale). Pure.
//
// Photo base maps have no flat plane in 3D and are left out, like the base
// maps without a usable print zone.
//
// Returns { sheets, addSlot }:
//   sheets: [{ id, name, baseMap, printZone (reference px), pagePt {width,
//     height}, positionPt {x, y} (top-left, y down), refSize {width, height},
//     meterByPx }]
//   addSlot: { positionPt, pagePt } — the "new base map" frame closing the
//     grid (same slot as the "+" frame of the 2D grid), null without listing.
// `baseMapIds` (pinned grid): explicit set instead of the listing's base
// maps (see composeBaseMapsGridSheets); `withAddSlot` false drops the frame.
export default function buildBaseMapsGrid3dSheets({
  baseMaps,
  listingId,
  baseMapIds,
  positions,
  withAddSlot = true,
}) {
  if (!listingId && !baseMapIds) return { sheets: [], addSlot: null };
  const { items, addSheet } = composeBaseMapsGridSheets({
    baseMaps,
    listingId,
    baseMapIds,
    positions,
  });

  const sheets = items
    .filter(({ baseMap }) => !baseMap.isPhoto)
    .map(({ baseMap, sheet }) => {
      const refSize = getBaseMapReferenceSize(baseMap);
      if (!refSize?.width || !refSize?.height) return null;
      return {
        id: baseMap.id,
        name: baseMap.name ?? "",
        baseMap,
        printZone: sheet.printZone,
        pagePt: { width: sheet.width, height: sheet.height },
        positionPt: { x: sheet.x, y: sheet.y },
        refSize: { width: refSize.width, height: refSize.height },
        meterByPx: getBaseMapRenderScale(baseMap),
      };
    })
    .filter(Boolean);

  const addSlot = withAddSlot
    ? {
        positionPt: { x: addSheet.x, y: addSheet.y },
        pagePt: { width: addSheet.width, height: addSheet.height },
      }
    : null;

  return { sheets, addSlot };
}
