import { useState } from "react";

import { Box, Button, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";

import DialogCreateAnnotationTemplate from "./DialogCreateAnnotationTemplate";

// ---------------------------------------------------------------------------
// EmptyStateCreateAnnotationTemplate — dashed "create your first template"
// box shown under the active listing band when the listing has no template
// (left panel + PopperMapListings). Owns its create dialog.
// ---------------------------------------------------------------------------

export default function EmptyStateCreateAnnotationTemplate({
  listingId,
  // "Nouveau modèle" draft defaults forwarded to the dialog (optional).
  templateDefaults,
  sx,
}) {
  // strings

  const descriptionS =
    "Aucun modèle dans cette liste. Créez votre premier modèle pour commencer à dessiner.";
  const createS = "Nouveau modèle";

  // state

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        mt: 1.5,
        mx: 1.5,
        px: 2,
        py: 3,
        textAlign: "center",
        bgcolor: "background.paper",
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 3,
        ...sx,
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {descriptionS}
      </Typography>
      <Button
        variant="contained"
        color="secondary"
        startIcon={<Add />}
        onClick={() => setOpenCreateDialog(true)}
      >
        {createS}
      </Button>

      {openCreateDialog && (
        <DialogCreateAnnotationTemplate
          open={openCreateDialog}
          onClose={() => setOpenCreateDialog(false)}
          listingId={listingId}
          templateDefaults={templateDefaults}
        />
      )}
    </Box>
  );
}
