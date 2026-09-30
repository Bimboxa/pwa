import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import {
  Alert,
  Box,
  Dialog,
  LinearProgress,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import IconButtonClose from "Features/layout/components/IconButtonClose";

import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";

import Scene3dZoneEditor from "./Scene3dZoneEditor";

import importScene3dFilesService from "../services/importScene3dFilesService";
import clipScene3dAssetsService from "../services/clipScene3dAssetsService";
import bakeScene3dZoneImageService from "../services/bakeScene3dZoneImageService";
import reloadScene3dBaseMapService from "../services/reloadScene3dBaseMapService";
import deleteScene3dAssetsService from "../services/deleteScene3dAssetsService";
import purgeOrphanScene3dAssetsService from "../services/purgeOrphanScene3dAssetsService";
import { unmarkScene3dImporting } from "../services/scene3dImportingGuard";
import { readScenePlyHeader } from "../utils/parseScenePly";
import matchScene3dFiles, {
  sortScene3dFiles,
} from "../utils/matchScene3dFiles";
import formatScene3dBytes from "../utils/formatScene3dBytes";
import getScene3dBaseMapDescriptor, {
  getScene3dBboxPolygon,
} from "../utils/getScene3dBaseMapDescriptor";
import { getZoneFromPolygon } from "../utils/scene3dZoneTransform";

const IMPORT_STEP_LABELS = {
  MESH: "Lecture du maillage",
  TEXTURES: "Conversion des textures",
  TOP_VIEW: "Projection sur le plan",
};
// share of each step in the import progress bar
const IMPORT_STEP_RANGES = {
  MESH: [0, 0.2],
  TEXTURES: [0.2, 0.97],
  TOP_VIEW: [0.97, 1],
};
const FINALIZE_STEP_LABELS = {
  CLIP: "Découpe du maillage",
  BAKE: "Rendu de l'image du fond de plan",
  CREATE: "Création du fond de plan",
};
const FINALIZE_STEP_RANGES = {
  CLIP: [0, 0.5],
  BAKE: [0.5, 0.95],
  CREATE: [0.95, 1],
};

const IMAGE_SIZE_OPTIONS = [
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

function getProgressRatio(ranges, progress) {
  if (!progress) return 0;
  const [from, to] = ranges[progress.step];
  return from + (to - from) * progress.ratio;
}

// Creation of a scan base map (« Scène 3D »): a photogrammetry scan (.ply
// mesh + its texture atlases) becomes a base map whose image is the top-down
// projection of a zone of interest, with the mesh + height map kept locally
// (db.scene3dAssets). Three steps:
//   FILES     pick the files, convert the scan (importScene3dFilesService);
//   ZONE      draw the zone of interest (rectangle / polygon) and rotate the
//             projection on the whole-scan preview (Scene3dZoneEditor);
//   FINALIZE  clip the scan to the zone, bake the zone image, create the
//             base map.
// Reload mode (`reloadBaseMap`, "Recharger les fichiers" of a scan base map
// whose data is missing on this device): FILES only, then the stored zone is
// applied to the new scan (reloadScene3dBaseMapService).
export default function DialogCreateBaseMapFromScene3d({
  open,
  onClose,
  listing,
  onCreated,
  reloadBaseMap = null,
}) {
  const dispatch = useDispatch();
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const abortRef = useRef(null);
  const importedRef = useRef(null);

  // strings

  const titleS = reloadBaseMap ? "Recharger la scène 3D" : "Scène 3D";
  const helperS =
    "Sélectionnez le maillage (.ply) et ses textures (.jpg), ou le dossier qui les contient.";
  const reloadHelperS =
    "Les données du scan ne sont pas sur cet appareil : rechargez les mêmes fichiers. La zone, l'échelle et l'altitude du fond de plan sont conservées.";
  const pickFilesS = "Choisir les fichiers";
  const pickFolderS = "Choisir un dossier";
  const imageSizeS = "Résolution de l'image";
  const importS = "Charger";
  const cancelS = "Annuler";
  const noPlyS = "Aucun fichier .ply dans la sélection.";
  const namePlaceholderS = "Nom du fond de plan";
  const createS = "Créer le fond de plan";
  const zoneSizeS = (zone) =>
    `Zone : ${zone.width.toFixed(1)} m × ${zone.height.toFixed(1)} m`;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const createBaseMapFromImage = useCreateBaseMapFromImage();
  const isReload = Boolean(reloadBaseMap);

  // state

  const [step, setStep] = useState("FILES");
  const [selection, setSelection] = useState(null);
  const [imageSizeKey, setImageSizeKey] = useState("STANDARD");
  const [importProgress, setImportProgress] = useState(null);
  const [finalizeProgress, setFinalizeProgress] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [imported, setImported] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [zoneValue, setZoneValue] = useState({
    rotationDeg: 0,
    polygonScan: null,
  });
  const [name, setName] = useState("");

  const isImporting = Boolean(importProgress);
  const isFinalizing = step === "FINALIZE";
  importedRef.current = imported;

  // effects — a fresh dialog starts clean; leftovers of abandoned imports
  // are deleted (the only moment the orphan purge runs).

  useEffect(() => {
    if (!open) return;
    setStep("FILES");
    setSelection(null);
    setImportProgress(null);
    setFinalizeProgress(null);
    setErrorMessage(null);
    setImported(null);
    setZoneValue({ rotationDeg: 0, polygonScan: null });
    setName("");
    purgeOrphanScene3dAssetsService().catch((error) => {
      console.error("[scene3d] orphan purge failed", error);
    });
  }, [open]);

  // preview object URL
  useEffect(() => {
    if (!imported?.preview?.blob) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(imported.preview.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imported]);

  // a converted scan that leaves the dialog without a base map is deleted
  useEffect(() => {
    if (open) return undefined;
    const pending = importedRef.current;
    if (!pending) return undefined;
    importedRef.current = null;
    const { sceneId } = pending.descriptor;
    deleteScene3dAssetsService(sceneId)
      .catch((error) =>
        console.error("[scene3d] failed to discard the pending scan", error)
      )
      .finally(() => unmarkScene3dImporting(sceneId));
    return undefined;
  }, [open]);

  // helpers

  const canImport = Boolean(selection?.plyFile) && !isImporting;
  const canCreate = step === "ZONE" && name.trim().length > 0 && !isFinalizing;

  const bbox = imported?.descriptor?.bbox;
  const currentZone =
    bbox &&
    getZoneFromPolygon(
      zoneValue.polygonScan ?? getScene3dBboxPolygon(bbox),
      zoneValue.rotationDeg
    );

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
      if (!name) {
        const dot = plyFile.name.lastIndexOf(".");
        setName(dot > 0 ? plyFile.name.slice(0, dot) : plyFile.name);
      }
    } catch (error) {
      setSelection(null);
      setErrorMessage(ERROR_MESSAGES[error?.code] ?? error?.message);
    }
  }

  function handleClose() {
    if (isFinalizing) return;
    if (isImporting) abortRef.current?.abort();
    onClose?.();
  }

  async function handleImportClick() {
    if (!canImport) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage(null);
    setImportProgress({ step: "MESH", ratio: 0 });
    try {
      const result = await importScene3dFilesService({
        plyFile: selection.plyFile,
        imageFiles: selection.imageFiles,
        projectId,
        onProgress: setImportProgress,
        signal: controller.signal,
      });
      if (isReload) {
        await handleReload(result);
      } else {
        setImported({ ...result, imageFiles: selection.imageFiles });
        setStep("ZONE");
      }
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
      setImportProgress(null);
      abortRef.current = null;
    }
  }

  async function handleReload(result) {
    setStep("FINALIZE");
    setFinalizeProgress({ step: "CLIP", ratio: 0 });
    try {
      await reloadScene3dBaseMapService({
        baseMapId: reloadBaseMap.id,
        imported: result,
        onProgress: (ratio) => setFinalizeProgress({ step: "CLIP", ratio }),
      });
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
      onClose?.();
    } catch (error) {
      console.error("[scene3d] reload failed", error);
      await deleteScene3dAssetsService(result.descriptor.sceneId).catch(
        () => {}
      );
      unmarkScene3dImporting(result.descriptor.sceneId);
      setStep("FILES");
      setErrorMessage(error?.message ?? "Le rechargement a échoué.");
    } finally {
      setFinalizeProgress(null);
    }
  }

  async function handleCreateClick() {
    if (!canCreate || !imported) return;
    const { descriptor, atlases, textureNames, imageFiles } = imported;
    const { sceneId } = descriptor;
    const rotationDeg = zoneValue.rotationDeg || 0;
    const polygon = zoneValue.polygonScan ?? getScene3dBboxPolygon(bbox);
    const zone = getZoneFromPolygon(polygon, rotationDeg);

    setStep("FINALIZE");
    setErrorMessage(null);
    setFinalizeProgress({ step: "CLIP", ratio: 0 });
    try {
      const clipped = await clipScene3dAssetsService({
        sceneId,
        projectId,
        bbox,
        polygon,
        onProgress: (ratio) => setFinalizeProgress({ step: "CLIP", ratio }),
      });
      if (clipped.faceCount === 0) {
        throw new Error("La zone ne contient aucune surface du scan.");
      }

      setFinalizeProgress({ step: "BAKE", ratio: 0 });
      const image = await bakeScene3dZoneImageService({
        sceneId,
        bbox,
        zone: { ...zone, rotationDeg },
        atlases,
        textureNames,
        imageFiles,
        topViewSizeKey: imageSizeKey,
        onProgress: (ratio) => setFinalizeProgress({ step: "BAKE", ratio }),
      });

      setFinalizeProgress({ step: "CREATE", ratio: 0 });
      const extension = image.fileMime === "image/webp" ? "webp" : "png";
      const file = new File([image.blob], `${name.trim()}.${extension}`, {
        type: image.fileMime,
      });
      const entity = await createBaseMapFromImage({
        file,
        name: name.trim(),
        listing,
        meterByPx: 1 / image.pxPerMeter,
        orientation: "HORIZONTAL",
        scene3d: getScene3dBaseMapDescriptor({
          descriptor,
          polygon,
          rotationDeg,
          clipped,
        }),
        source: "scene3d",
      });
      if (!entity) throw new Error("Le fond de plan n'a pas pu être créé.");
      // the base map owns the scan now
      importedRef.current = null;
      setImported(null);
      unmarkScene3dImporting(sceneId);
      setFinalizeProgress({ step: "CREATE", ratio: 1 });
      onCreated?.(entity);
    } catch (error) {
      console.error("[scene3d] base map creation failed", error);
      const message = error?.message ?? "La création du fond de plan a échoué.";
      setErrorMessage(message);
      dispatch(setToaster({ message, isError: true }));
      setStep("ZONE");
    } finally {
      setFinalizeProgress(null);
    }
  }

  // render

  const importRatio = getProgressRatio(IMPORT_STEP_RANGES, importProgress);
  const finalizeRatio = getProgressRatio(
    FINALIZE_STEP_RANGES,
    finalizeProgress
  );

  const filesPanel = (
    <Paper
      sx={{
        width: 460,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Typography variant="h6">{titleS}</Typography>
      <Typography variant="body2" color="text.secondary">
        {isReload ? reloadHelperS : helperS}
      </Typography>

      <Box sx={{ display: "flex", gap: 1 }}>
        <ButtonGeneric
          label={pickFilesS}
          variant="outlined"
          size="small"
          disabled={isImporting}
          onClick={() => filesInputRef.current?.click()}
        />
        <ButtonGeneric
          label={pickFolderS}
          variant="outlined"
          size="small"
          disabled={isImporting}
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

      {!isReload && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {imageSizeS}
          </Typography>
          <ToggleButtonGroup
            value={imageSizeKey}
            exclusive
            size="small"
            disabled={isImporting}
            onChange={(_e, next) => next && setImageSizeKey(next)}
          >
            {IMAGE_SIZE_OPTIONS.map((option) => (
              <ToggleButton key={option.key} value={option.key}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      {isImporting && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            {IMPORT_STEP_LABELS[importProgress.step]}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.round(importRatio * 100)}
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
    </Paper>
  );

  const finalizePanel = (
    <Paper
      sx={{
        width: 420,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Typography variant="h6">{titleS}</Typography>
      <Typography variant="caption" color="text.secondary">
        {finalizeProgress
          ? FINALIZE_STEP_LABELS[finalizeProgress.step]
          : FINALIZE_STEP_LABELS.CREATE}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.round(finalizeRatio * 100)}
      />
    </Paper>
  );

  return (
    <Dialog open={open} onClose={handleClose} fullScreen>
      <Box
        sx={{
          position: "relative",
          width: 1,
          flexGrow: 1,
          minHeight: 0,
          bgcolor: "grey.200",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {step === "ZONE" && imported && previewUrl && (
          <Box sx={{ position: "absolute", inset: 0 }}>
            <Scene3dZoneEditor
              previewUrl={previewUrl}
              previewSize={{
                width: imported.preview.width,
                height: imported.preview.height,
              }}
              bbox={bbox}
              pxPerMeter={imported.preview.pxPerMeter}
              value={zoneValue}
              onChange={setZoneValue}
            />
          </Box>
        )}

        {step === "FILES" && filesPanel}
        {step === "FINALIZE" && finalizePanel}

        {step !== "FINALIZE" && (
          <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}>
            <Paper>
              <IconButtonClose onClose={handleClose} />
            </Paper>
          </Box>
        )}

        {step === "ZONE" && (
          <Box
            sx={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
            }}
          >
            <Paper
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 2,
                py: 1,
              }}
            >
              {currentZone && (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {zoneSizeS(currentZone)}
                </Typography>
              )}
              <TextField
                size="small"
                placeholder={namePlaceholderS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <ButtonGeneric
                label={createS}
                variant="contained"
                color="secondary"
                disabled={!canCreate}
                onClick={handleCreateClick}
              />
            </Paper>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
