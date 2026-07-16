// Capture-mode controls, rendered inside the "Export rapide" white section of
// PanelPrint. Sub-sections: Format (aspect ratio), Légende, Étiquettes,
// Export — the first two and the last are shared with the POV viewer panels
// (SectionCaptureFormat / SectionCaptureLegend / SectionCaptureExport).
// No own white card / scroll container — it lives inside the parent section.

import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeLabelsAutoLayout,
  setImageModeLabelsInMargin,
} from "../mapEditorSlice";

import captureMapAsPng from "../utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import { Box, Typography, Divider } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";
import SectionCaptureFormat from "./SectionCaptureFormat";
import SectionCaptureLegend from "./SectionCaptureLegend";
import SectionCaptureExport from "./SectionCaptureExport";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

export default function PanelCaptureMode({ viewerKey = "MAP" }) {
  const dispatch = useDispatch();

  // data

  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const labelsAutoLayout = useSelector(
    (s) => s.mapEditor.imageModeLabelsAutoLayout
  );
  const labelsInMargin = useSelector(
    (s) => s.mapEditor.imageModeLabelsInMargin
  );
  // Label auto-layout only applies to the 2D map (in 3D the labels are baked
  // into the WebGL snapshot).
  const isThreed = isThreedFamilyViewerKey(viewerKey);
  // Right panel occludes the viewport's right side; mirror the overlay so the
  // exported crop matches the displayed capture rect.
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

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
        rightInset,
        prepareHost,
      });
    }
  }

  function handleToggleLabelsAutoLayout(checked) {
    dispatch(setImageModeLabelsAutoLayout(Boolean(checked)));
  }

  function handleToggleLabelsInMargin(checked) {
    dispatch(setImageModeLabelsInMargin(Boolean(checked)));
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
      <Divider />

      <SectionCaptureFormat />

      <SectionCaptureLegend />

      {/* ÉTIQUETTES — display-only auto-layout (2D map only) */}
      {!isThreed && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="overline" sx={LABEL_SX}>
            Étiquettes
          </Typography>
          <FieldCheck
            value={labelsAutoLayout}
            onChange={handleToggleLabelsAutoLayout}
            label="Organiser les étiquettes"
            options={{ type: "switch", showAsInline: true }}
          />
          {labelsAutoLayout && (
            <FieldCheck
              value={labelsInMargin}
              onChange={handleToggleLabelsInMargin}
              label="Ranger en marge du cadre"
              options={{ type: "switch", showAsInline: true }}
            />
          )}
        </Box>
      )}

      <SectionCaptureExport onExport={handleExport} />
    </Box>
  );
}
