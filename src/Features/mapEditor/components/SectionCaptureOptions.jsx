import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeHighRes,
  setImageModeWhiteBackground,
} from "../mapEditorSlice";

import { Box, Typography } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// Capture output options (resolution + white background), driving the shared
// imageMode state used by the capture pipeline. Used by SectionCaptureExport
// ("Export rapide") and by the POV Cadrage tab.
export default function SectionCaptureOptions() {
  const dispatch = useDispatch();

  // data

  const highRes = useSelector((s) => s.mapEditor.imageModeHighRes);
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );

  // handlers

  function handleToggleHighRes(checked) {
    dispatch(setImageModeHighRes(Boolean(checked)));
  }

  function handleToggleWhiteBackground(checked) {
    dispatch(setImageModeWhiteBackground(Boolean(checked)));
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="overline" sx={LABEL_SX}>
        Options
      </Typography>
      <FieldCheck
        value={highRes}
        onChange={handleToggleHighRes}
        label="Haute définition"
        options={{ type: "switch", showAsInline: true }}
      />
      <FieldCheck
        value={whiteBackground}
        onChange={handleToggleWhiteBackground}
        label="Fond blanc"
        options={{ type: "switch", showAsInline: true }}
      />
    </Box>
  );
}
