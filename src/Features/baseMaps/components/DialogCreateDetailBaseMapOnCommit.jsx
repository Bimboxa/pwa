import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import db from "App/db/db";

import { Box, CircularProgress, TextField } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ImageGeneric from "Features/images/components/ImageGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useResourceFile from "Features/resources/hooks/useResourceFile";
import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";

import findOrCreateDetailBaseMap from "../services/findOrCreateDetailBaseMap";

// Dialog of the PDF_PAGE_DETAIL commit interceptor (first placement of a
// DETAIL annotation for a PDF page with no detail baseMap yet): preview of
// the armed page + name / detailRef of the detail baseMap to create. Confirm
// creates the baseMap then resumes the parked annotation commit with the
// link; cancel drops the commit (nothing is created, the tool stays armed).
//
// Preview: the context thumbnail (200px, captured at arm time) shows
// instantly, then is swapped for the page rendered at full preview
// resolution once the PDF is re-parsed here (usePdfPageImageUrl already
// upgrades low → standard dpi progressively).
export default function DialogCreateDetailBaseMapOnCommit({
  pending,
  onResume,
  onCancel,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Nouveau fond de plan de détail";
  const nameS = "Nom du fond de plan";
  const detailRefS = "Référence";
  const createS = "Créer";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: userEmail } = useUserEmail();

  const context = pending?.context ?? {};
  const defaultName = context.resourceName
    ? `${context.resourceName.replace(/\.pdf$/i, "")} — p.${context.pageNumber}`
    : "";

  // Full-resolution page preview, replacing the arm-time thumbnail once
  // rendered.
  const resource = useLiveQuery(
    async () =>
      context.resourceId ? db.resources.get(context.resourceId) : null,
    [context.resourceId]
  );
  const { file } = useResourceFile(resource);
  const { pdfDocument } = usePdfDocument(file);
  const { imageUrl } = usePdfPageImageUrl(
    pdfDocument,
    context.pageNumber,
    context.rotation ?? 0
  );
  const previewUrl = imageUrl ?? context.thumbnail;

  // state

  const [name, setName] = useState(defaultName);
  const [detailRef, setDetailRef] = useState("");
  const [creating, setCreating] = useState(false);

  // handlers

  async function handleCreateClick() {
    setCreating(true);
    try {
      const record = await findOrCreateDetailBaseMap({
        resourceId: context.resourceId,
        pageNumber: context.pageNumber,
        rotation: context.rotation ?? 0,
        projectId,
        createdBy: userEmail,
        name,
        detailRef,
      });
      if (record) dispatch(triggerEntitiesTableUpdate("baseMaps"));
      else
        console.warn(
          "[resources] detail baseMap not created (PDF file missing?)"
        );
      // Same degradation as before: a missing PDF leaves the annotation
      // unlinked instead of blocking its creation.
      onResume({
        newAnnotation: {
          ...pending.newAnnotation,
          detailBaseMapId: record?.id ?? null,
        },
      });
    } finally {
      setCreating(false);
    }
  }

  // render

  return (
    <DialogGeneric
      width={400}
      open={Boolean(pending)}
      onClose={onCancel}
      title={titleS}
    >
      <Box
        sx={{
          p: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            placeholder={nameS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            placeholder={detailRefS}
            value={detailRef}
            onChange={(e) => setDetailRef(e.target.value)}
            size="small"
            sx={{ width: 120, flexShrink: 0 }}
          />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <ButtonGeneric
            label={createS}
            onClick={handleCreateClick}
            variant="contained"
            color="secondary"
            disabled={name.trim().length === 0 || creating}
            startIcon={creating ? <CircularProgress size={16} /> : null}
          />
        </Box>
      </Box>
      {previewUrl && <ImageGeneric url={previewUrl} />}
    </DialogGeneric>
  );
}
