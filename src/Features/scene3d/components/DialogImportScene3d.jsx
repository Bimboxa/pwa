import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { closeScene3dImportDialog } from "../scene3dSlice";
import {
  setNewAnnotation,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Alert,
  Box,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import importScene3dFilesService from "../services/importScene3dFilesService";
import purgeOrphanScene3dAssetsService from "../services/purgeOrphanScene3dAssetsService";
import reloadScene3dAnnotationService from "../services/reloadScene3dAnnotationService";
import {
  addPendingScene3d,
  discardPendingScenes3d,
  unmarkScene3dImporting,
} from "../services/scene3dPendingStore";
import { readScenePlyHeader } from "../utils/parseScenePly";
import matchScene3dFiles, {
  sortScene3dFiles,
} from "../utils/matchScene3dFiles";
import formatScene3dBytes from "../utils/formatScene3dBytes";

const STEP_LABELS = {
  MESH: "Lecture du maillage",
  TEXTURES: "Conversion des textures",
  TOP_VIEW: "Projection sur le plan",
};
// share of each step in the overall progress bar
const STEP_RANGES = {
  MESH: [0, 0.2],
  TEXTURES: [0.2, 0.97],
  TOP_VIEW: [0.97, 1],
};

const TOP_VIEW_SIZE_OPTIONS = [
  { key: "STANDARD", label: "Standard" },
  { key: "HIGH", label: "Haute" },
];

const ERROR_MESSAGES = {
  PLY_ASCII_UNSUPPORTED:
    "Les fichiers PLY au format ASCII ne sont pas pris en charge (exporter en binaire).",
  PLY_NO_FACES:
    "Ce fichier PLY ne contient pas de faces (les nuages de points ne sont pas pris en charge).",
  PLY_TRUNCATED: "Le fichier PLY est incomplet.",
  PLY_INVALID: "Ce fichier n'est pas un PLY valide.",
  PLY_UNSUPPORTED_LAYOUT:
    "La structure de ce fichier PLY n'est pas prise en charge.",
};

// Import dialog of a SCENE_3D annotation (3D scan: a .ply mesh + its texture
// atlases). Redux-driven (scene3d.importDialog), mounted once in the map
// editor:
//   - armed tool: the scan is converted, then the ONE_CLICK placement is
//     armed with its descriptor on the draft (the click sets the origin);
//   - "Recharger les fichiers": the converted scan replaces the missing data
//     of an existing annotation.
export default function DialogImportScene3d() {
  const dispatch = useDispatch();
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const abortRef = useRef(null);

  // strings

  const titleS = "Charger une scène 3D";
  const helperS =
    "Sélectionnez le maillage (.ply) et ses textures (.jpg), ou le dossier qui les contient.";
  const pickFilesS = "Choisir les fichiers";
  const pickFolderS = "Choisir un dossier";
  const topViewS = "Résolution de la projection 2D";
  const importS = "Charger";
  const cancelS = "Annuler";
  const noScaleS =
    "Le fond de plan n'a pas d'échelle : définissez-la avant de placer une scène 3D.";
  const noPlyS = "Aucun fichier .ply dans la sélection.";

  // data

  const importDialog = useSelector((s) => s.scene3d.importDialog);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMap = useMainBaseMap();
  const draftSceneId = useSelector(
    (s) => s.annotations.newAnnotation?.scene3d?.sceneId ?? null
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const open = Boolean(importDialog);
  const isReload = Boolean(importDialog?.annotationId);
  const meterByPx = baseMap?.getMeterByPx?.();
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;

  // state

  const [selection, setSelection] = useState(null);
  const [topViewSizeKey, setTopViewSizeKey] = useState("STANDARD");
  const [progress, setProgress] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const isRunning = Boolean(progress);

  // effects — a fresh dialog starts clean; leftovers of abandoned imports
  // are deleted (the only moment the orphan purge runs).

  useEffect(() => {
    if (!open) return;
    setSelection(null);
    setProgress(null);
    setErrorMessage(null);
    (async () => {
      try {
        await discardPendingScenes3d(null);
        await purgeOrphanScene3dAssetsService();
      } catch (error) {
        console.error("[scene3d] orphan purge failed", error);
      }
    })();
  }, [open]);

  // effects — a scan waiting for its placement click is dropped as soon as
  // its draft is no longer the armed one (Escape, another tool…): its data
  // would otherwise stay in db.scene3dAssets with nothing referencing it.

  useEffect(() => {
    discardPendingScenes3d(enabledDrawingMode ? draftSceneId : null);
  }, [draftSceneId, enabledDrawingMode]);

  // helpers

  const canImport =
    Boolean(selection?.plyFile) && !isRunning && (isReload || hasScale);

  const progressRatio = progress
    ? STEP_RANGES[progress.step][0] +
      (STEP_RANGES[progress.step][1] - STEP_RANGES[progress.step][0]) *
        progress.ratio
    : 0;

  // handlers

  async function handleFilesChange(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setErrorMessage(null);

    const { plyFile, imageFiles } = sortScene3dFiles(files);
    if (!plyFile) {
      setSelection(null);
      setErrorMessage(noPlyS);
      return;
    }
    try {
      const header = await readScenePlyHeader({
        size: plyFile.size,
        read: (start, end) => plyFile.slice(start, end).arrayBuffer(),
      });
      const { textureFiles, missingNames } = matchScene3dFiles(
        header.textureNames,
        imageFiles
      );
      const usedFiles = textureFiles.filter(Boolean);
      setSelection({
        plyFile,
        imageFiles: usedFiles,
        textureCount: header.textureNames.length,
        missingNames,
        totalBytes: usedFiles.reduce((sum, f) => sum + f.size, plyFile.size),
      });
    } catch (error) {
      setSelection(null);
      setErrorMessage(ERROR_MESSAGES[error?.code] ?? error?.message);
    }
  }

  function handleClose() {
    if (isRunning) abortRef.current?.abort();
    dispatch(closeScene3dImportDialog());
  }

  async function handleImportClick() {
    if (!canImport) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage(null);
    setProgress({ step: "MESH", ratio: 0 });
    try {
      const imported = await importScene3dFilesService({
        plyFile: selection.plyFile,
        imageFiles: selection.imageFiles,
        projectId,
        topViewSizeKey,
        onProgress: setProgress,
        signal: controller.signal,
      });

      const { sceneId } = imported.descriptor;
      try {
        if (isReload) {
          await reloadScene3dAnnotationService({
            annotationId: importDialog.annotationId,
            imported,
          });
          dispatch(triggerAnnotationsUpdate());
        } else {
          addPendingScene3d(sceneId, imported.topView);
          dispatch(
            setNewAnnotation({
              ...importDialog.draftProps,
              type: "SCENE_3D",
              scene3d: imported.descriptor,
            })
          );
          dispatch(setEnabledDrawingMode(importDialog.drawingMode));
        }
      } finally {
        unmarkScene3dImporting(sceneId);
      }
      dispatch(closeScene3dImportDialog());
    } catch (error) {
      if (error?.code !== "SCENE_3D_IMPORT_CANCELLED") {
        console.error("[scene3d] import failed", error);
        const message =
          ERROR_MESSAGES[error?.code] ??
          error?.message ??
          "Le chargement de la scène a échoué.";
        setErrorMessage(message);
        dispatch(setToaster({ message, isError: true }));
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  // render

  return (
    <DialogGeneric width={440} open={open} onClose={handleClose} title={titleS}>
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {helperS}
        </Typography>

        {!isReload && !hasScale && <Alert severity="warning">{noScaleS}</Alert>}

        <Box sx={{ display: "flex", gap: 1 }}>
          <ButtonGeneric
            label={pickFilesS}
            variant="outlined"
            size="small"
            disabled={isRunning}
            onClick={() => filesInputRef.current?.click()}
          />
          <ButtonGeneric
            label={pickFolderS}
            variant="outlined"
            size="small"
            disabled={isRunning}
            onClick={() => folderInputRef.current?.click()}
          />
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".ply,.jpg,.jpeg,.png,.webp"
            hidden
            onChange={handleFilesChange}
          />
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory=""
            hidden
            onChange={handleFilesChange}
          />
        </Box>

        {selection && (
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: "background.default",
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
              {selection.plyFile.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {`${selection.imageFiles.length} / ${selection.textureCount} textures · ${formatScene3dBytes(selection.totalBytes)}`}
            </Typography>
            {selection.missingNames.length > 0 && (
              <Alert severity="warning" sx={{ mt: 0.5 }}>
                {`Textures manquantes (affichées sans image) : ${selection.missingNames.join(", ")}`}
              </Alert>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {topViewS}
          </Typography>
          <ToggleButtonGroup
            value={topViewSizeKey}
            exclusive
            size="small"
            disabled={isRunning}
            onChange={(_e, next) => next && setTopViewSizeKey(next)}
          >
            {TOP_VIEW_SIZE_OPTIONS.map((option) => (
              <ToggleButton key={option.key} value={option.key}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {isRunning && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {STEP_LABELS[progress.step]}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.round(progressRatio * 100)}
            />
          </Box>
        )}

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <ButtonGeneric label={cancelS} onClick={handleClose} />
          <ButtonGeneric
            label={importS}
            variant="contained"
            color="secondary"
            disabled={!canImport}
            onClick={handleImportClick}
          />
        </Box>
      </Box>
    </DialogGeneric>
  );
}
