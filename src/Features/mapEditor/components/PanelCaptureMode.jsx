// Capture-mode controls, rendered inside the "Export rapide" white section of
// PanelPrint. Sub-sections: Format (aspect ratio), Légende, Étiquettes,
// Export — the first two and the last are shared with the POV viewer panels
// (SectionCaptureFormat / SectionCaptureLegend / SectionCaptureExport).
// No own white card / scroll container — it lives inside the parent section.

import { useSelector } from "react-redux";

import captureMapAsPng from "../utils/captureMapAsPng";
import { selectCaptureRightInset } from "../utils/captureRightInset";
import useCaptureAspectRatio from "../hooks/useCaptureAspectRatio";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import { Box, Divider } from "@mui/material";

import SectionCaptureFormat from "./SectionCaptureFormat";
import SectionCaptureLegend from "./SectionCaptureLegend";
import SectionCaptureLabels from "./SectionCaptureLabels";
import SectionCaptureExport from "./SectionCaptureExport";

export default function PanelCaptureMode({ viewerKey = "MAP" }) {
  // data

  // Resolved value (preset key or the base map's numeric ratio) — must match
  // the frame drawn by ImageModeOverlay.
  const aspectRatio = useCaptureAspectRatio();
  // Label auto-layout only applies to the 2D map (in 3D the labels are baked
  // into the WebGL snapshot).
  const isThreed = isThreedFamilyViewerKey(viewerKey);
  // Right panel occludes the viewport's right side; mirror the overlay so the
  // exported crop matches the displayed capture rect
  // (selectCaptureRightInset owns the rule).
  const rightInset = useSelector(selectCaptureRightInset);
  const roundedBorderMask = useSelector((s) => s.mapEditor.imageModeBorder);

  // handlers

  async function handleExport({ mode, fileName, pixelRatio, whiteBackground }) {
    // The 3D WebGL canvas can't be cloned by html-to-image (no
    // preserveDrawingBuffer) — snapshot it into a capturable img first.
    const prepareHost = isThreed ? snapshotThreedCanvasForCapture : undefined;
    if (mode === "clipboard") {
      await captureMapAsPng({
        viewerKey,
        target: "clipboard",
        aspectRatio,
        pixelRatio,
        whiteBackground,
        roundedBorderMask,
        rightInset,
        prepareHost,
      });
    } else {
      await captureMapAsPng({
        viewerKey,
        target: "download",
        format: mode, // "pdf" | "png"
        fileName,
        aspectRatio,
        pixelRatio,
        whiteBackground,
        roundedBorderMask,
        rightInset,
        prepareHost,
      });
    }
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
      <Divider />

      <SectionCaptureFormat />

      <SectionCaptureLegend />

      {/* ÉTIQUETTES — display-only auto-layout (2D map only) */}
      {!isThreed && <SectionCaptureLabels />}

      <SectionCaptureExport onExport={handleExport} />
    </Box>
  );
}
