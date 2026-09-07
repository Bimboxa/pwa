import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useImportProjectExportZip from "Features/projects/hooks/useImportProjectExportZip";

import {
  Box,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Typography,
} from "@mui/material";
import { Upload } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import loadKrtoZip from "../services/loadKrtoZip";
import detectImportZipKind from "../utils/detectImportZipKind";
import hasProjectLocalData from "Features/projects/services/hasProjectLocalData";

// Dashboard ".zip" button. Accepts two zip kinds, routed by
// detectImportZipKind BEFORE any loader runs:
// - Krto zip (one scope): loadKrtoZip, unchanged behaviour (opens the scope).
// - Project export zip (manifest.json): loadProjectExportZip via
//   useImportProjectExportZip, then the project is selected in the dashboard.
//
// "Dupliquer": regenerate every id (new project + new scopes, re-owned to the
// importer). Unchecked: ids kept verbatim — for a project export that already
// exists locally, the user confirms a wipe-then-import (exact replica).
export default function ButtonLoadKrtoFile({ variant, size, sx }) {
  const dispatch = useDispatch();

  // state

  const [open, setOpen] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);
  // project export whose verbatim import awaits the wipe confirmation
  const [pendingProjectImport, setPendingProjectImport] = useState(null);

  // data

  const { importProjectZip, loading: importingProject } =
    useImportProjectExportZip();

  // strings

  const extension = "zip";
  const krtoS = `.${extension}`;
  const loadS = `Charger un fichier ${krtoS}`;
  const duplicateS = "Dupliquer";
  const hintS = "Krto (un plan de repérage) ou export complet d'un projet";
  const wipeMessageS = pendingProjectImport
    ? `Le projet "${pendingProjectImport.manifest.projectName ?? pendingProjectImport.manifest.projectId}" existe déjà sur cet appareil. Ses données locales seront supprimées puis remplacées par le contenu du fichier (réplique exacte, y compris les modifications non synchronisées).`
    : "";

  // helpers

  const busy = loading || importingProject;

  function closeDialog() {
    setDuplicate(false);
    setPendingProjectImport(null);
    setOpen(false);
  }

  // handlers

  async function handleLoadKrtoFile(files) {
    const file = files?.[0];
    if (!file || busy) return;
    setLoading(true);
    try {
      const detected = await detectImportZipKind(file);

      if (detected.kind === "KRTO") {
        const { project, scope } = await loadKrtoZip(file, { duplicate });
        if (project) {
          dispatch(setSelectedProjectId(project.id));
          if (scope) dispatch(setSelectedScopeId(scope.id));
          dispatch(setOnboardingIsActive(false));
        }
        closeDialog();
        return;
      }

      // PROJECT_EXPORT
      const { manifest } = detected;
      if (!duplicate && (await hasProjectLocalData(manifest.projectId))) {
        // keep the main dialog open behind the confirmation
        setPendingProjectImport({ file, manifest });
        return;
      }
      const project = await importProjectZip({
        file,
        manifest,
        duplicate,
        wipeExisting: false,
      });
      if (project) closeDialog();
    } catch (error) {
      console.error("[ButtonLoadKrtoFile] load error", error);
      dispatch(
        setToaster({
          message: `Échec du chargement : ${error.message || "erreur inconnue"}`,
          severity: "error",
        })
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmWipeAndImport() {
    if (!pendingProjectImport) return;
    const { file, manifest } = pendingProjectImport;
    setPendingProjectImport(null);
    const project = await importProjectZip({
      file,
      manifest,
      duplicate: false,
      wipeExisting: true,
    });
    if (project) closeDialog();
  }

  // render

  return (
    <>
      <Tooltip title={loadS}>
        <ButtonGeneric
          startIcon={<Upload />}
          label={krtoS}
          onClick={() => setOpen(true)}
          variant={variant}
          size={size}
          sx={sx}
        />
      </Tooltip>
      <DialogGeneric open={open} onClose={busy ? undefined : closeDialog}>
        <Box
          sx={{
            width: 300,
            height: 300,
            p: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <BoxCenter
            sx={{
              flex: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <ContainerFilesSelector
              onFilesChange={handleLoadKrtoFile}
              callToActionLabel={loadS}
              accept=".zip"
              loading={busy}
            />
          </BoxCenter>
          <Typography variant="caption" sx={{ mt: 1, color: "text.secondary" }}>
            {hintS}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={duplicate}
                disabled={busy}
                onChange={(e) => setDuplicate(e.target.checked)}
              />
            }
            label={<Typography variant="body2">{duplicateS}</Typography>}
          />
        </Box>
      </DialogGeneric>
      <DialogDeleteRessource
        open={Boolean(pendingProjectImport)}
        onClose={() => setPendingProjectImport(null)}
        onConfirmAsync={handleConfirmWipeAndImport}
        message={wipeMessageS}
      />
    </>
  );
}
