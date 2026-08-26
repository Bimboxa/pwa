import { useState } from "react";

import useRenameProject from "Features/projects/hooks/useRenameProject";
import { LINK_ERROR } from "Features/projects/hooks/useLinkProjectToReferentiel";

import { Box, Button, CircularProgress, Alert } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FormProject from "Features/projects/components/FormProject";

// Dialog to rename a free (unlinked) local project and/or change its number,
// from the dashboard project card. Updates the local project then propagates
// the new fields to its remote scopeConfigurations.

export default function DialogRenameProject({
  open,
  onClose,
  project,
  onSaved,
}) {
  // state

  const [tempProject, setTempProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // data

  const rename = useRenameProject();

  // strings

  const titleS = "Renommer le projet";
  const saveS = "Enregistrer";

  // helpers

  function getErrorMessage(e) {
    if (e?.type === LINK_ERROR.CLIENT_REF_TAKEN) {
      const p = e.project;
      return `Ce numéro est déjà utilisé par un autre projet (${
        p?.name ?? "?"
      }).`;
    }
    return "Une erreur est survenue pendant l'enregistrement.";
  }

  // handlers

  function handleClose() {
    if (saving) return;
    setTempProject(null);
    setError(null);
    onClose();
  }

  function handleChange(newProject) {
    setError(null);
    setTempProject(newProject);
  }

  async function handleSave() {
    if (!tempProject || saving) return;
    try {
      setSaving(true);
      setError(null);
      await rename({
        projectId: project.id,
        name: tempProject.name,
        clientRef: tempProject.clientRef,
      });
      setSaving(false);
      handleClose();
      if (onSaved) onSaved();
    } catch (e) {
      console.error("[DialogRenameProject] rename error", e);
      setError(getErrorMessage(e));
      setSaving(false);
    }
  }

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} title={titleS} width={440}>
      <Box sx={{ px: 2, py: 1, display: "flex", flexDirection: "column" }}>
        <FormProject project={project} onChange={handleChange} />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <Box
          sx={{
            width: 1,
            display: "flex",
            justifyContent: "end",
            mt: 2,
            pb: 1,
          }}
        >
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSave}
            disabled={!tempProject || saving}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : saveS}
          </Button>
        </Box>
      </Box>
    </DialogGeneric>
  );
}
