import { useState } from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import loadBaseMapShareZip from "../services/loadBaseMapShareZip";

export default function DialogLoadBaseMapShare({ open, onClose }) {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleFilesChange(files) {
    const file = files?.[0];
    if (!file) {
      onClose?.();
      return;
    }
    try {
      setLoading(true);
      await loadBaseMapShareZip(file, { projectId, scopeId });
    } catch (err) {
      console.error("loadBaseMapShareZip failed", err);
    } finally {
      setLoading(false);
      onClose?.();
    }
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose}>
      <Box sx={{ width: 300, height: 300, p: 2 }}>
        <BoxCenter
          sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <ContainerFilesSelector
            onFilesChange={handleFilesChange}
            callToActionLabel="Charger un fond de plan avec annotations"
            accept=".zip"
            loading={loading}
          />
        </BoxCenter>
      </Box>
    </DialogGeneric>
  );
}
