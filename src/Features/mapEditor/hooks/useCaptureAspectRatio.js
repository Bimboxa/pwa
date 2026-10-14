import { useSelector } from "react-redux";

import useMainBaseMap from "./useMainBaseMap";
import { getPrintZoneAspect } from "Features/baseMaps/utils/printZone";

// Resolved aspect ratio of the capture frame: the preset keys ("LANDSCAPE" /
// "SQUARE" / "PORTRAIT") pass through unchanged, and the "BASE_MAP" option
// resolves to the active base map's PRINT ZONE page ratio (A0..A4 sheet,
// landscape / portrait) so the frame hugs the printed sheet exactly — a
// capture is then one page of the plan. Falls back to the image ratio when
// the base map has no resolvable print zone. getCaptureRectBounds accepts
// both forms.
//
// Every consumer of the frame geometry (overlay, save bars, capture, POV
// snapshot) must read the ratio through this hook — passing the raw
// "BASE_MAP" string to getCaptureRectBounds falls back to LANDSCAPE.
export default function useCaptureAspectRatio() {
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const baseMap = useMainBaseMap();

  if (aspectRatio !== "BASE_MAP") return aspectRatio;

  const zone = baseMap?.getPrintZone?.();
  if (zone?.format && zone?.orientation) {
    return getPrintZoneAspect(zone.format, zone.orientation);
  }

  const imageSize = baseMap?.getImageSize?.();
  if (!imageSize?.width || !imageSize?.height) return "LANDSCAPE";
  return imageSize.width / imageSize.height;
}
