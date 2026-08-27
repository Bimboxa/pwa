import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Alert, Box, Button, Typography } from "@mui/material";

import db from "App/db/db";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useResourceFile from "Features/resources/hooks/useResourceFile";
import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";
import findOrCreateDetailBaseMap from "Features/baseMaps/services/findOrCreateDetailBaseMap";
import DialogSelectFolio from "./DialogSelectFolio";

// "Folio" tab of the annotation properties panel (DETAIL annotations): the
// PDF page linked to the detail bubble via annotation.detailBaseMapId → a
// detail baseMap whose createdFrom stores the page provenance. Shows a
// rendered preview of the page when the PDF is available locally, and falls
// back to the thumbnail stored on the baseMap record (post-Krto-import).
export default function SectionAnnotationFolioContent({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const noFolioS = "Aucun folio associé";
  const chooseS = "Choisir un folio";
  const editS = "Modifier";
  const removeS = "Retirer";
  const openDetailS = "Ouvrir le détail";
  const pageS = "Page";
  const missingResourceS = "Ressource introuvable";
  const missingFileS =
    "Fichier PDF absent en local. Rechargez-le depuis le panneau Ressources.";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: userEmail } = useUserEmail();

  const detailBaseMapId = annotation?.detailBaseMapId;

  const detailBaseMap = useLiveQuery(async () => {
    if (!detailBaseMapId) return null;
    const record = await db.baseMaps.get(detailBaseMapId);
    return record && !record.deletedAt ? record : null;
  }, [detailBaseMapId]);

  const createdFrom = detailBaseMap?.createdFrom;

  // The resourceId hint may be stale (resource deleted then re-imported):
  // fall back to matching the original PDF file name.
  const resource = useLiveQuery(async () => {
    if (!createdFrom) return null;
    if (createdFrom.resourceId) {
      const byId = await db.resources.get(createdFrom.resourceId);
      if (byId && !byId.deletedAt) return byId;
    }
    if (!createdFrom.pdfFileName || !detailBaseMap?.projectId) return null;
    const candidates = (
      await db.resources
        .where("projectId")
        .equals(detailBaseMap.projectId)
        .toArray()
    ).filter((r) => !r.deletedAt && r.name === createdFrom.pdfFileName);
    return candidates[0] ?? null;
  }, [
    createdFrom?.resourceId,
    createdFrom?.pdfFileName,
    detailBaseMap?.projectId,
  ]);

  const resourceLoading = resource === undefined;
  const resourceMissing = Boolean(createdFrom) && !resourceLoading && !resource;

  const { file, fileIsMissing } = useResourceFile(resource ?? null);
  const { pdfDocument } = usePdfDocument(file);
  const { imageUrl } = usePdfPageImageUrl(
    pdfDocument,
    createdFrom?.pageNumber ?? 1,
    createdFrom?.rotation ?? 0
  );

  const updateAnnotation = useUpdateAnnotation();

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // helpers

  const previewUrl = imageUrl ?? detailBaseMap?.image?.thumbnail ?? null;

  // handlers

  async function handleConfirm(newFolio) {
    // The dialog still returns a folio-shaped object: find or create the
    // matching detail baseMap and link the annotation to it.
    const record = await findOrCreateDetailBaseMap({
      resourceId: newFolio.resourceId,
      pageNumber: newFolio.pageNumber,
      rotation: newFolio.rotation ?? 0,
      projectId,
      createdBy: userEmail,
    });
    if (record) dispatch(triggerEntitiesTableUpdate("baseMaps"));
    await updateAnnotation({
      id: annotation.id,
      detailBaseMapId: record?.id ?? null,
    });
    setOpenDialog(false);
  }

  async function handleRemove() {
    // Unlink only: the detail baseMap is kept (it may be shared by other
    // detail annotations).
    await updateAnnotation({ id: annotation.id, detailBaseMapId: null });
  }

  function handleOpenDetail() {
    dispatch(setSelectedMainBaseMapId(detailBaseMapId));
  }

  // render - no folio

  if (!detailBaseMap) {
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
          alt={`${pageS} ${createdFrom?.pageNumber}`}
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
            {createdFrom?.pageNumber}
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
          {resourceMissing
            ? missingResourceS
            : (resource?.name ?? createdFrom?.pdfFileName)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {`${pageS} ${createdFrom?.pageNumber}`}
        </Typography>
      </Box>

      {fileIsMissing && <Alert severity="warning">{missingFileS}</Alert>}

      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" variant="outlined" onClick={handleOpenDetail}>
          {openDetailS}
        </Button>
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
        initialFolio={
          resourceMissing || !resource
            ? null
            : {
                resourceId: resource.id,
                pageNumber: createdFrom?.pageNumber,
                rotation: createdFrom?.rotation ?? 0,
              }
        }
        onConfirm={handleConfirm}
      />
    </Box>
  );
}
