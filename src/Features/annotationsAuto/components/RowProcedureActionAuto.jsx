import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import ProcedureActionButtons from "./ProcedureActionButtons";

import { Box, Typography } from "@mui/material";
import { lighten } from "@mui/material/styles";
import { AutoFixHigh } from "@mui/icons-material";

/**
 * Toolbar row (between quantities and actions) for an annotation whose template
 * is linked to an ANNOTATIONS_CREATOR procedure. Left: procedure name. Right:
 * play / reset / refresh applied to this single annotation as source.
 */
export default function RowProcedureActionAuto({ annotation }) {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const procedureKey = annotation?.annotationTemplate?.procedureKey;
  const procedure = procedureKey
    ? procedures.find((p) => p.key === procedureKey)
    : null;

  // render

  if (!procedure || procedure.type !== "ANNOTATIONS_CREATOR") return null;

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
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}
      >
        <AutoFixHigh sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
          {procedure.label}
        </Typography>
      </Box>

      <ProcedureActionButtons
        procedureKey={procedureKey}
        baseMapId={annotation?.baseMapId}
        sourceAnnotationIds={[annotation?.id]}
      />
    </Box>
  );
}
