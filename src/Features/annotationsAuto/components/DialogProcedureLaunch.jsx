import { Box, Typography } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionsProcedureProperties from "./SectionsProcedureProperties";
import ProcedureActionButtons from "./ProcedureActionButtons";

/**
 * Launch dialog of a listing-level procedure, opened from the play button of
 * the "Dessin auto" section: the same content as the right-panel properties
 * (description, source / created templates, parameters) plus the number of
 * source annotations concerned on the base map, and the launch buttons.
 */
export default function DialogProcedureLaunch({
  open,
  onClose,
  procedure,
  listingId,
  baseMapId,
  sourceAnnotationIds,
}) {
  // strings

  const captionS = "Dessin auto";
  const launchS = "Lancer";

  // helpers

  const sourceIds = sourceAnnotationIds ?? [];

  // render

  if (!procedure) return null;

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      width={420}
      title={
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.4,
            }}
          >
            {captionS}
          </Typography>
          <Typography variant="h6" noWrap sx={{ fontWeight: "bold" }}>
            {procedure.label}
          </Typography>
        </Box>
      }
    >
      <BoxFlexVStretch
        sx={{
          overflow: "auto",
          gap: 1,
          px: 2,
          pt: 2,
          pb: 2,
          bgcolor: "background.default",
        }}
      >
        <SectionsProcedureProperties
          procedure={procedure}
          listingId={listingId}
          baseMapId={baseMapId}
          sourceAnnotationIds={sourceAnnotationIds}
          showLaunch={false}
        />
      </BoxFlexVStretch>

      {/* Footer: reset / re-run icons, then the labelled "Lancer" button */}
      {listingId && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            px: 2,
            py: 1.5,
            bgcolor: "background.default",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <ProcedureActionButtons
            procedureKey={procedure.key}
            baseMapId={baseMapId}
            sourceAnnotationIds={sourceIds}
            disabled={sourceIds.length === 0}
            playLabel={launchS}
            relaunchOnPlay
          />
        </Box>
      )}
    </DialogGeneric>
  );
}
