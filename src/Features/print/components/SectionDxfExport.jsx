import { useState } from "react";

import { Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import { Download, Architecture } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import exportAnnotationsAsDxf from "Features/print/services/exportAnnotationsAsDxfService";

// "Export DXF" card of the Export tool — module Dessin, 2D editor only (the
// gate lives in PanelPrint). One-click export of the active base map's
// annotations; annotations must come fully resolved from useAnnotationsV2.
export default function SectionDxfExport({ annotations, baseMap }) {
  // state

  const [exporting, setExporting] = useState(false);

  // helpers

  const meterByPx = baseMap?.getMeterByPx?.() ?? null;
  const disabled = !baseMap || annotations.length === 0 || exporting;

  // handlers

  async function handleDownload() {
    if (exporting) return;
    setExporting(true);
    // Let the spinner paint before the synchronous DXF build.
    await new Promise((r) => requestAnimationFrame(r));
    try {
      exportAnnotationsAsDxf({ annotations, baseMap });
    } catch (e) {
      console.error("[SectionDxfExport] DXF export failed", e);
    } finally {
      setExporting(false);
    }
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 0.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Architecture fontSize="small" color="action" />
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Export DXF
          </Typography>
        </Box>
        <Chip label={annotations.length} size="small" />
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        Annotations du fond de plan actif, un calque par liste.
        {!meterByPx && " Échelle non définie — export en pixels."}
      </Typography>

      <Button
        size="small"
        variant="outlined"
        fullWidth
        startIcon={
          exporting ? (
            <CircularProgress size={14} thickness={5} />
          ) : (
            <Download sx={{ fontSize: 16 }} />
          )
        }
        disabled={disabled}
        onClick={handleDownload}
        sx={{ textTransform: "none" }}
      >
        {exporting ? "Export en cours…" : "Télécharger (.dxf)"}
      </Button>
    </WhiteSectionGeneric>
  );
}
