import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setImageModeHighRes } from "../mapEditorSlice";

import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  PictureAsPdf,
  Image as ImageIcon,
  ContentCopy,
  Download,
} from "@mui/icons-material";

import FieldCheck from "Features/form/components/FieldCheck";
import SectionCaptureOptions from "./SectionCaptureOptions";

// Export modes (output format selector). Label + extension are driven by the
// selected mode.
const EXPORT_MODES = {
  pdf: { label: "Télécharger en PDF", ext: ".pdf" },
  png: { label: "Télécharger en PNG", ext: ".png" },
  clipboard: { label: "Copier dans le presse-papier", ext: "" },
};

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

const SEG_SX = {
  flexDirection: "column",
  gap: 0.25,
  py: 0.5,
  textTransform: "none",
  fontSize: 11,
};

// Export controls (filename + pdf/png/clipboard + "Haute définition" +
// primary button). Resolution is an export-time option, so its switch always
// lives here; the framing options (SectionCaptureOptions — white background)
// are shown inline unless the host panel displays them elsewhere
// (showOptions={false} — the POV panel puts them in its Cadrage tab). The
// actual capture is delegated to `onExport`. Used by PanelCaptureMode
// ("Export rapide") and by the POV properties panel.
export default function SectionCaptureExport({
  onExport,
  defaultFilename = "capture",
  showOptions = true,
}) {
  const dispatch = useDispatch();

  // data

  const highRes = useSelector((s) => s.mapEditor.imageModeHighRes);
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );

  // state

  const [filename, setFilename] = useState(defaultFilename);
  const [mode, setMode] = useState("pdf"); // "pdf" | "png" | "clipboard"

  // helpers

  const modeCfg = EXPORT_MODES[mode];

  // High def doubles the html-to-image pixelRatio (default 2 → 4).
  const pixelRatio = highRes ? 4 : 2;

  // handlers

  function handleModeChange(_, value) {
    if (!value) return;
    setMode(value);
  }

  function handleToggleHighRes(checked) {
    dispatch(setImageModeHighRes(Boolean(checked)));
  }

  async function handlePrimaryExport() {
    const baseName = (filename || "").trim() || defaultFilename;
    try {
      await onExport?.({
        mode,
        fileName: baseName + modeCfg.ext,
        pixelRatio,
        whiteBackground,
      });
    } catch (err) {
      console.error("[SectionCaptureExport] export failed", err);
    }
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="overline" sx={LABEL_SX}>
        Export
      </Typography>

      {/* Nom du fichier */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 1, mb: 0.5 }}
        >
          Nom du fichier
        </Typography>
        <TextField
          size="small"
          fullWidth
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder={defaultFilename}
          InputProps={{
            endAdornment: modeCfg.ext ? (
              <InputAdornment position="end">
                <Typography variant="body2" color="text.secondary">
                  {modeCfg.ext}
                </Typography>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {/* Sélecteur de format */}
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleModeChange}
        size="small"
        fullWidth
      >
        <ToggleButton value="pdf" sx={SEG_SX}>
          <PictureAsPdf sx={{ fontSize: 18 }} />
          PDF
        </ToggleButton>
        <ToggleButton value="png" sx={SEG_SX}>
          <ImageIcon sx={{ fontSize: 18 }} />
          PNG
        </ToggleButton>
        <ToggleButton value="clipboard" sx={SEG_SX}>
          <ContentCopy sx={{ fontSize: 18 }} />
          Copier
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Résolution (export-time option) */}
      <FieldCheck
        value={highRes}
        onChange={handleToggleHighRes}
        label="Haute définition"
        options={{ type: "switch", showAsInline: true }}
      />

      {/* Options de cadrage (fond blanc) */}
      {showOptions && <SectionCaptureOptions />}

      {/* Action principale */}
      <Button
        variant="contained"
        size="small"
        fullWidth
        startIcon={mode === "clipboard" ? <ContentCopy /> : <Download />}
        onClick={handlePrimaryExport}
        sx={{ textTransform: "none", mt: 0.5 }}
      >
        {modeCfg.label}
      </Button>
    </Box>
  );
}
