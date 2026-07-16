import { useSelector, useDispatch } from "react-redux";

import { setImageModeTitle } from "../mapEditorSlice";

import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { FormatSize } from "@mui/icons-material";

import FieldCheck from "Features/form/components/FieldCheck";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// Capture title banner controls (show the POV description as a chip inside
// the capture rect + font size), driving the shared imageModeTitle state
// read by ImageModeOverlay. Used by the POV Cadrage tab.
export default function SectionCaptureTitle() {
  const dispatch = useDispatch();

  // data

  const title = useSelector((s) => s.mapEditor.imageModeTitle);

  // helpers

  const visible = Boolean(title?.visible);
  const fontSize = title?.fontSize || 12;

  // handlers

  function handleToggleVisible(checked) {
    dispatch(setImageModeTitle({ visible: Boolean(checked) }));
  }

  function handleFontSizeChange(_, value) {
    if (!value) return;
    dispatch(setImageModeTitle({ fontSize: Number(value) }));
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="overline" sx={LABEL_SX}>
        Titre
      </Typography>

      <FieldCheck
        value={visible}
        onChange={handleToggleVisible}
        label="Afficher la description"
        options={{ type: "switch", showAsInline: true }}
      />

      {visible && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Taille
          </Typography>
          <ToggleButtonGroup
            value={String(fontSize)}
            exclusive
            onChange={handleFontSizeChange}
            size="small"
          >
            <ToggleButton value="10">
              <FormatSize sx={{ fontSize: 14 }} />
            </ToggleButton>
            <ToggleButton value="12">
              <FormatSize sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value="14">
              <FormatSize sx={{ fontSize: 22 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}
    </Box>
  );
}
