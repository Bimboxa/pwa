import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import { Box } from "@mui/material";
import { Upload } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import IconButtonAction from "Features/layout/components/IconButtonAction";

import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import loadKrtoFile from "Features/krtoFile/services/loadKrtoFile";

export default function IconButtonAnnotationTemplatesUpload() {
  const dispatch = useDispatch();
  // strings

  const loadS = "Charger des modèles";

  // data

  const listingId = useSelector((s) => s.listings.selectedListingId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // state

  const [open, setOpen] = useState(false);

  // handlers

  async function handleLoadKrtoFile(files) {
    const file = files?.[0];
    if (file) {
      await loadKrtoFile(file, {
        loadAnnotationTemplatesToListingId: listingId,
        loadDataToProjectId: projectId,
      });
    }
    dispatch(triggerAnnotationTemplatesUpdate());
    setOpen(false);
  }
  return (
    <>
      <IconButtonAction
        icon={Upload}
        label={loadS}
        onClick={() => setOpen(true)}
      />

      <DialogGeneric open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 300, height: 300, p: 2 }}>
          <BoxCenter
            sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
          >
            <ContainerFilesSelector
              onFilesChange={handleLoadKrtoFile}
              callToActionLabel={loadS}
              accept=".krtol"
            />
          </BoxCenter>
        </Box>
      </DialogGeneric>
    </>
  );
}
