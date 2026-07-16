import { useSelector, useDispatch } from "react-redux";

import {
  setImageModeWhiteBackground,
  setImageModeBorder,
} from "../mapEditorSlice";

import { Box } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";

// Capture framing options (white background + rounded border), driving the
// shared imageMode state used by the capture pipeline. Used by
// SectionCaptureExport ("Export rapide") and by the POV Cadrage tab. The
// "Haute définition" switch is NOT here: resolution only applies at export
// time (SectionCaptureExport).
export default function SectionCaptureOptions() {
  const dispatch = useDispatch();

  // data

  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );
  const border = useSelector((s) => s.mapEditor.imageModeBorder);

  // handlers

  function handleToggleWhiteBackground(checked) {
    dispatch(setImageModeWhiteBackground(Boolean(checked)));
  }

  function handleToggleBorder(checked) {
    dispatch(setImageModeBorder(Boolean(checked)));
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FieldCheck
        value={whiteBackground}
        onChange={handleToggleWhiteBackground}
        label="Fond blanc"
        options={{ type: "switch", showAsInline: true }}
      />
      <FieldCheck
        value={border}
        onChange={handleToggleBorder}
        label="Bordure"
        options={{ type: "switch", showAsInline: true }}
      />
    </Box>
  );
}
