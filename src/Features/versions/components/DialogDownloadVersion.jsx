import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setSelectedVersionId } from "../versionsSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useVersion from "../hooks/useVersion";

import { DialogTitle, Box, Typography } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import CircularProgressGeneric from "Features/layout/components/CircularProgressGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import downloadAndLoadKrtoVersionService from "../services/downloadAndLoadKrtoVersionService";
import updateKrtoVersionService from "../services/updateKrtoVersionService";

export default function DialogDownloadVersion({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const downloadS = "Charger la version";
  const saveS = "Mettre à jour la version";

  // data

  const version = useVersion();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const orgaCode = useSelector((s) => s.appConfig.orgaCode);

  // helpers

  const title =
    `Version ${version?.mediaMetadata?.label}` ??
    version?.id ??
    "Sélectionner une version";
  // state

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);

  // handlers

  async function handleDownload() {
    setLoading(true);
    const project = await downloadAndLoadKrtoVersionService({
      id: version.id,
      onProgress: setProgress,
    });
    if (project) dispatch(setSelectedProjectId(project.id));
    setLoading(false);
    onClose();
  }

  async function handleSave() {
    setUpdating(true);
    const project = await updateKrtoVersionService({
      id: version.id,
      orgaCode,
      projectId,
      label: version?.mediaMetadata?.label,
      author: version?.mediaMetadata?.author,
      description: version?.mediaMetadata?.description,
    });
    setUpdating(false);
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} width="350px">
      <DialogTitle>{title}</DialogTitle>

      <Box
        sx={{
          width: 1,
          display: "flex",
          visibility: progress > 0 ? "visible" : "hidden",
          justifyContent: "center",
          alignItems: "center",
          my: 1,
        }}
      >
        <CircularProgressGeneric value={20} />
      </Box>
      <ButtonInPanelV2
        label={downloadS}
        onClick={handleDownload}
        variant="contained"
        loading={loading}
      />
      <ButtonInPanelV2
        label={saveS}
        onClick={handleSave}
        variant="outlined"
        loading={updating}
      />
    </DialogGeneric>
  );
}
