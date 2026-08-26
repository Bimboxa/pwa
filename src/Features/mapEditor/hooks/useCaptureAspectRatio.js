import { useSelector } from "react-redux";

import useMainBaseMap from "./useMainBaseMap";

// Resolved aspect ratio of the capture frame: the preset keys ("LANDSCAPE" /
// "SQUARE" / "PORTRAIT") pass through unchanged, and the "BASE_MAP" option
// resolves to the active base map's numeric width/height ratio so the frame
// hugs the base map exactly. getCaptureRectBounds accepts both forms.
//
// Every consumer of the frame geometry (overlay, save bars, capture, POV
// snapshot) must read the ratio through this hook — passing the raw
// "BASE_MAP" string to getCaptureRectBounds falls back to LANDSCAPE.
export default function useCaptureAspectRatio() {
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const baseMap = useMainBaseMap();

  if (aspectRatio !== "BASE_MAP") return aspectRatio;

  const imageSize = baseMap?.getImageSize?.();
  if (!imageSize?.width || !imageSize?.height) return "LANDSCAPE";
  return imageSize.width / imageSize.height;
}
