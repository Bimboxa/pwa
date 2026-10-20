import getPageDimensions from "./getPageDimensions";
import fitContainerToBaseMap from "./fitContainerToBaseMap";

// Default layout of a base map container on a portfolio page — the single
// rule shared by the base map assignment (PortfolioPageSvg), the carnet page
// creation (useCreateBaseMapPage) and the « Reset » button:
// - print zone (« Zone d'impression »): the page takes the zone's format /
//   orientation and the container is the FULL page with the zone rect as
//   viewBox — 1 zone px = 1 / pagePxPerPt pt, so a 1:N scale and the page-pt
//   text sizes are exact; the cartouche / title bar draw over it.
// - no zone but an image size: fitted to the content area with a full-image
//   viewBox.
// - nothing known: null (caller only binds the base map).
//
// Returns { x, y, width, height, viewBox, pageFormat } where pageFormat is
// { format, orientation } to apply on the page, or null when the page keeps
// its own format.
export default function getBaseMapContainerDefaultLayout({
  printZone,
  imageSize,
  contentArea,
}) {
  if (printZone) {
    const dims = getPageDimensions(printZone.format, printZone.orientation);
    return {
      x: 0,
      y: 0,
      width: dims.width,
      height: dims.height,
      viewBox: {
        x: printZone.x,
        y: printZone.y,
        width: printZone.width,
        height: printZone.height,
      },
      pageFormat: {
        format: printZone.format,
        orientation: printZone.orientation,
      },
    };
  }

  if (imageSize && contentArea) {
    const fitted = fitContainerToBaseMap(imageSize, contentArea);
    return {
      ...fitted,
      viewBox: { x: 0, y: 0, width: imageSize.width, height: imageSize.height },
      pageFormat: null,
    };
  }

  return null;
}
