import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";
import { lighten } from "@mui/material/styles";
import { AutoFixHigh } from "@mui/icons-material";

import ProcedureActionButtons from "./ProcedureActionButtons";

/**
 * Launch band for an ANNOTATIONS_CREATOR procedure: icon + procedure name
 * (with the configured water level as secondary text below it) on the left,
 * play / reset / refresh on the right. Shared by the "Auto" popper, the
 * annotation toolbar rows and the "Dessin auto" panel.
 */
export default function RowProcedureLauncher({
  procedure,
  baseMapId,
  sourceAnnotationIds,
  sourceListingId = null,
  standardRun = false,
  disabled = false,
  sx,
}) {
  // data

  const waterHeight = useSelector((s) => s.annotationsAuto.waterHeight);

  // helpers

  const parsedWater =
    waterHeight != null && waterHeight !== "" ? parseFloat(waterHeight) : null;
  const showWater =
    procedure?.showWaterHeight === true &&
    parsedWater != null &&
    Number.isFinite(parsedWater);

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1.25,
        py: 0.5,
        gap: 0.5,
        bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.85),
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          minWidth: 0,
        }}
      >
        <AutoFixHigh sx={{ fontSize: 16, color: "text.secondary" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {procedure?.label}
          </Typography>
          {showWater && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block", lineHeight: 1.2 }}
            >
              {`Ht. eau: ${parsedWater.toFixed(2)} m`}
            </Typography>
          )}
        </Box>
      </Box>

      <ProcedureActionButtons
        procedureKey={procedure?.key}
        baseMapId={baseMapId}
        sourceAnnotationIds={sourceAnnotationIds}
        sourceListingId={sourceListingId}
        standardRun={standardRun}
        disabled={disabled}
      />
    </Box>
  );
}
