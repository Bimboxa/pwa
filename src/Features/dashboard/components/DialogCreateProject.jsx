import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedProjectKeyInDashboard } from "../dashboardSlice";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, CircularProgress } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FormProject from "Features/projects/components/FormProject";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function DialogCreateProject({ open, onClose }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const createProject = useCreateProject();

  // free projects (created without a référentiel entity) still get a default
  // type from the config (e.g. "PROJECT" for edx); undefined → stays typeless.
  // No default baseMap listings here: the dossiers come from the Krto
  // configuration chosen afterwards (or the generic fallback).
  const defaultProjectType = appConfig?.creation?.defaultProjectType;

  // state

  const [tempProject, setTempProject] = useState({});
  const [creating, setCreating] = useState(false);

  // strings

  const titleS = "Créer un nouveau projet";
  const createS = "Créer";

  // helpers

  const canCreate =
    Boolean(tempProject.name?.trim()) && Boolean(tempProject.clientRef?.trim());

  // handlers

  function handleClose() {
    setTempProject({});
    onClose();
  }

  async function handleCreate() {
    if (!canCreate || creating) return;
    try {
      setCreating(true);
      const project = await createProject({
        ...tempProject,
        type: tempProject.type ?? defaultProjectType,
      });
      if (project) {
        // select the created project so "Nouveau Krto" is one click away
        dispatch(setSelectedProjectKeyInDashboard(`local_${project.id}`));
        handleClose();
      }
    } finally {
      setCreating(false);
    }
  }

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} title={titleS} width={400}>
      <Box sx={{ px: 2, py: 1, width: 1 }}>
        <FormProject project={tempProject} onChange={setTempProject} />
      </Box>
      <ButtonInPanelV2
        label={creating ? <CircularProgress size={18} /> : createS}
        onClick={handleCreate}
        variant="contained"
        disabled={!canCreate || creating}
      />
    </DialogGeneric>
  );
}
