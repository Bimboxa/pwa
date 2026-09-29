import {
  getPrintZonePageDimensionsPt,
  isPrintZoneValid,
} from "Features/baseMaps/utils/printZone";

// Sheet of paper a base map lies on in the grid: the page of its print zone,
// in paper points. `scale` = paper pt per image px.
// Returns null when the base map has no usable print zone / image.
export default function getBaseMapSheet({ baseMap, position }) {
  const printZone = baseMap?.getPrintZone?.();
  if (!isPrintZoneValid(printZone)) return null;

  const page = getPrintZonePageDimensionsPt(
    printZone.format,
    printZone.orientation
  );
  if (!page?.width || !page?.height) return null;

  return {
    id: baseMap.id,
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    width: page.width,
    height: page.height,
    scale: page.width / printZone.width,
    printZone,
  };
}
