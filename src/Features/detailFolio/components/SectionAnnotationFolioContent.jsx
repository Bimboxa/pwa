import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Alert, Box, Button, Typography } from "@mui/material";

import db from "App/db/db";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useResourceFile from "Features/resources/hooks/useResourceFile";
import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";
import DialogSelectFolio from "./DialogSelectFolio";

// "Folio" tab of the annotation properties panel (DETAIL annotations): the
// page of a project resource associated with the detail bubble. Shows a
// rendered preview of the page when the PDF is available locally, and falls
// back to the snapshot thumbnail stored on the folio (post-Krto-import).
export default function SectionAnnotationFolioContent({ annotation }) {
  // strings

  const noFolioS = "Aucun folio associé";
  const chooseS = "Choisir un folio";
  const editS = "Modifier";
  const removeS = "Retirer";
  const pageS = "Page";
  const missingResourceS = "Ressource introuvable";
  const missingFileS =
    "Fichier PDF absent en local. Rechargez-le depuis le panneau Ressources.";

  // data

  const folio = annotation?.folio;

  const resource = useLiveQuery(async () => {
    if (!folio?.resourceId) return null;
    return (await db.resources.get(folio.resourceId)) ?? null;
  }, [folio?.resourceId]);

  const resourceLoading = resource === undefined;
  const resourceMissing =
    Boolean(folio) && !resourceLoading && (!resource || resource.deletedAt);

  const { file, fileIsMissing } = useResourceFile(
    resourceMissing ? null : resource
  );
  const { pdfDocument } = usePdfDocument(file);
  const { imageUrl } = usePdfPageImageUrl(
    pdfDocument,
    folio?.pageNumber ?? 1,
    folio?.rotation ?? 0
  );

  const updateAnnotation = useUpdateAnnotation();

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // helpers

  const previewUrl = imageUrl ?? folio?.thumbnail ?? null;

  // handlers

  async function handleConfirm(newFolio) {
    await updateAnnotation({ id: annotation.id, folio: newFolio });
    setOpenDialog(false);
  }

  async function handleRemove() {
    await updateAnnotation({ id: annotation.id, folio: null });
  }

  // render - no folio

  if (!folio) {
    return (
      <Box
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {noFolioS}
        </Typography>
        <Button variant="contained" onClick={() => setOpenDialog(true)}>
          {chooseS}
        </Button>
        <DialogSelectFolio
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          initialFolio={null}
          onConfirm={handleConfirm}
        />
      </Box>
    );
  }

  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      {previewUrl ? (
        <Box
          component="img"
          src={previewUrl}
          alt={`${pageS} ${folio.pageNumber}`}
          sx={{
            width: 1,
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        />
      ) : (
        <Box
          sx={{
            width: 1,
            aspectRatio: "210 / 297",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
            border: "1px dashed",
            borderColor: "text.disabled",
            borderRadius: 1,
            color: "text.secondary",
          }}
        >
          <Typography variant="h6" component="span" fontWeight="bold">
            {folio.pageNumber}
          </Typography>
        </Box>
      )}

      <Box>
        <Typography
          variant="body2"
          sx={{
            fontWeight: "bold",
            ...(resourceMissing && { color: "warning.main" }),
          }}
        >
          {resourceMissing ? missingResourceS : resource?.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {`${pageS} ${folio.pageNumber}`}
        </Typography>
      </Box>

      {fileIsMissing && <Alert severity="warning">{missingFileS}</Alert>}

      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setOpenDialog(true)}
          disabled={fileIsMissing}
        >
          {editS}
        </Button>
        <Button size="small" color="error" onClick={handleRemove}>
          {removeS}
        </Button>
      </Box>

      <DialogSelectFolio
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        initialFolio={resourceMissing ? null : folio}
        onConfirm={handleConfirm}
      />
    </Box>
  );
}
