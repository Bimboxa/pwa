import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeLabelsAutoLayout,
  setImageModeLabelsInMargin,
} from "../mapEditorSlice";

import { Box, Typography } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// "Étiquettes" capture-mode block: display-only label auto-layout options
// (2D map only — in 3D the labels are baked into the WebGL snapshot).
// Shared by the Export rapide panel (PanelCaptureMode) and the capture
// tool's Cadrage tab (PanelCaptureTool).
export default function SectionCaptureLabels() {
  const dispatch = useDispatch();

  // data

  const labelsAutoLayout = useSelector(
    (s) => s.mapEditor.imageModeLabelsAutoLayout
  );
  const labelsInMargin = useSelector(
    (s) => s.mapEditor.imageModeLabelsInMargin
  );

  // handlers

  function handleToggleLabelsAutoLayout(checked) {
    dispatch(setImageModeLabelsAutoLayout(Boolean(checked)));
  }

  function handleToggleLabelsInMargin(checked) {
    dispatch(setImageModeLabelsInMargin(Boolean(checked)));
  }

  // render

  return (
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
  );
}
