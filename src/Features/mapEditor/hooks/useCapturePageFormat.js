import { useSelector } from "react-redux";

import useMainBaseMap from "./useMainBaseMap";

// Page format of the exported capture (PDF page, cartouche "Format" cell):
// - frame locked on the base map ("BASE_MAP" ratio) with a resolvable print
//   zone → the zone's own sheet (A0..A4 + orientation), `locked: true` so the
//   format pickers show it disabled;
// - otherwise the panel's A4 / A3 choice, orientation deduced from the frame
//   preset (PORTRAIT → portrait, LANDSCAPE / SQUARE → landscape).
export default function useCapturePageFormat() {
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const pageFormat = useSelector((s) => s.mapEditor.imageModePageFormat);
  const baseMap = useMainBaseMap();

  if (aspectRatio === "BASE_MAP") {
    const zone = baseMap?.getPrintZone?.();
    if (zone?.format && zone?.orientation) {
      return {
        format: zone.format,
        orientation: zone.orientation,
        locked: true,
      };
    }
  }

  return {
    format: pageFormat || "A3",
    orientation: aspectRatio === "PORTRAIT" ? "portrait" : "landscape",
    locked: false,
  };
}
