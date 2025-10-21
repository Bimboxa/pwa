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

export default function DialogDownloadVersion({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const title = "Télécharger la version";
  const downloadS = "Télécharger";

  // data

  const version = useVersion();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const orgaCode = useSelector((s) => s.appConfig.orgaCode);

  // state

  const [loading, setLoading] = useState(false);
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

  return (
    <DialogGeneric open={open} onClose={onClose} width="350px">
      <DialogTitle>{title}</DialogTitle>
      <Box
        sx={{
          width: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography variant="body1">{version?.mediaMetadata?.label}</Typography>
      </Box>

      <BoxFlexVStretch>
        <CircularProgressGeneric value={progress * 100} />
      </BoxFlexVStretch>
      <ButtonInPanelV2
        label={downloadS}
        onClick={handleDownload}
        variant="contained"
        loading={loading}
      />
    </DialogGeneric>
  );
}
