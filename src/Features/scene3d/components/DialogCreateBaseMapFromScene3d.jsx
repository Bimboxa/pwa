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
import readDroppedEntries from "Features/promptIaProject/utils/readDroppedEntries";
import getScene3dBaseMapDescriptor, {
  getScene3dBboxPolygon,
} from "../utils/getScene3dBaseMapDescriptor";
import { getZoneFromPolygon } from "../utils/scene3dZoneTransform";

import scanResources from "Features/localScans/services/scanResources";
import {
  buildLocalScanZonePreview,
  readLocalScanSample,
} from "Features/localScans/services/createLocalScanZonePreview";
import createScanBaseMapFromZoneService from "Features/localScans/services/createScanBaseMapFromZoneService";

const IMPORT_STEP_LABELS = {
  MESH: "Lecture du maillage",
  TEXTURES: "Conversion des textures",
  TOP_VIEW: "Projection sur le plan",
  SAMPLE: "Lecture d’un échantillon du nuage",
};
// share of each step in the import progress bar
const IMPORT_STEP_RANGES = {
  MESH: [0, 0.2],
  TEXTURES: [0.2, 0.97],
  TOP_VIEW: [0.97, 1],
  SAMPLE: [0, 1],
};
const FINALIZE_STEP_LABELS = {
  CLIP: "Découpe du maillage",
  BAKE: "Rendu de l'image du fond de plan",
  CREATE: "Création du fond de plan",
  DECODE: "Lecture du nuage de points",
  PROJECT: "Projection sur le plan",
};
const FINALIZE_STEP_RANGES = {
  CLIP: [0, 0.5],
  BAKE: [0.5, 0.95],
  CREATE: [0.95, 1],
  DECODE: [0, 0.7],
  PROJECT: [0.7, 0.95],
};

const IMAGE_SIZE_OPTIONS = [
  { key: "STANDARD", label: "Standard" },
  { key: "HIGH", label: "Haute" },
];

const ERROR_MESSAGES = {
  PLY_ASCII_UNSUPPORTED:
    "Les fichiers PLY au format ASCII ne sont pas pris en charge (exporter en binaire).",
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

const stripExtension = (fileName) => {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
};

// Creation of a scan base map (« Scène 3D »): a 3D scan becomes a base map
// whose image is the top-down projection of a zone of interest. Two kinds of
// PLY, told apart by the header (faces or not), same screens:
//   MESH    photogrammetry mesh (.ply + its texture atlases): converted
//           (importScene3dFilesService), zone drawn on the whole-scan
//           preview, then clipped + baked; the mesh and its height map are
//           kept locally (db.scene3dAssets) — baseMap.scene3d;
//   POINTS  point cloud (the Scan 3D tool files): a sample is projected for
//           the zone preview (density or colours, also the image of the
//           base map), the zone is decoded, saved as a project resource and
//           projected over its whole height (createScanBaseMapFromZoneService)
//           — baseMap.localScan, editable later in the Scan 3D tool.
// Three steps: FILES (pick the files, or a scan of the Ressources through
// `scanResource`) → ZONE (Scene3dZoneEditor) → FINALIZE.
// Reload mode (`reloadBaseMap`, "Recharger les fichiers" of a mesh base map
// whose data is missing on this device): FILES only, then the stored zone is
// applied to the new scan (reloadScene3dBaseMapService).
export default function DialogCreateBaseMapFromScene3d({
  open,
  onClose,
  listing,
  onCreated,
  reloadBaseMap = null,
  scanResource = null,
}) {
  const dispatch = useDispatch();
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const abortRef = useRef(null);
  const importedRef = useRef(null);

  // strings

  const titleS = reloadBaseMap ? "Recharger la scène 3D" : "Scène 3D";
  const helperS =
    "Sélectionnez le scan (.ply : maillage avec ses textures .jpg, ou nuage de points), ou le dossier qui les contient.";
  const reloadHelperS =
    "Les données du scan ne sont pas sur cet appareil : rechargez les mêmes fichiers. La zone, l'échelle et l'altitude du fond de plan sont conservées.";
  const dropS = "Glisser-déposer les fichiers ou le dossier du scan ici";
  const pickFilesS = "Choisir les fichiers";
  const pickFolderS = "Choisir un dossier";
  const imageSizeS = "Résolution de l'image";
  const importS = "Charger";
  const cancelS = "Annuler";
  const noPlyS = "Aucun fichier .ply dans la sélection.";
  const reloadPointsS =
    "Ce fond de plan est un maillage : rechargez un PLY avec des faces.";
  const missingFileS =
    "Le fichier de ce scan est absent de cet appareil. Rechargez-le depuis Ressources.";
  const namePlaceholderS = "Nom du fond de plan";
  const createS = "Créer le fond de plan";
  const upS = "Axe vertical";
  const imageModeS = "Image";
  const densityS = "Densité";
  const rgbS = "Couleurs";
  const pointsS = "Nuage de points";
  const splatS =
    "Mode Réaliste : la zone limite les points, les gaussiennes restent entières.";
  const zoneSizeS = (zone) =>
    `Zone : ${zone.width.toFixed(1)} m × ${zone.height.toFixed(1)} m`;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const axesYawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
  const createBaseMapFromImage = useCreateBaseMapFromImage();
  const isReload = Boolean(reloadBaseMap);

  // state

  const [step, setStep] = useState("FILES");
  const [selection, setSelection] = useState(null);
  const [dragOver, setDragOver] = useState(false);
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
  // point cloud: the preview sample, its vertical axis and image mode
  const [sample, setSample] = useState(null);
  const [up, setUp] = useState("Z");
  const [imageMode, setImageMode] = useState("density");
  const [pointPreview, setPointPreview] = useState(null);

  const isImporting = Boolean(importProgress);
  const isFinalizing = step === "FINALIZE";
  const isPoints = selection?.kind === "POINTS";
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
    setSample(null);
    setPointPreview(null);
    setZoneValue({ rotationDeg: 0, polygonScan: null });
    setUp("Z");
    setImageMode("density");
    setName("");
    purgeOrphanScene3dAssetsService().catch((error) => {
      console.error("[scene3d] orphan purge failed", error);
    });
  }, [open]);

  // A scan of the Ressources: its file is the selection, read right away.
  useEffect(() => {
    if (!open || !scanResource) return;
    let alive = true;
    scanResources.source(scanResource).then(
      (file) => {
        if (!alive) return;
        if (!file) {
          setErrorMessage(missingFileS);
          return;
        }
        const zone = scanResource.scan?.zone;
        const next = {
          plyFile: file,
          kind: "POINTS",
          resource: scanResource,
          vertexCount: scanResource.scan?.count ?? null,
          totalBytes: file.size,
        };
        setSelection(next);
        setName(stripExtension(file.name));
        if (zone) {
          setUp(zone.up === "Y" ? "Y" : "Z");
          setZoneValue({
            rotationDeg: zone.rotationDeg ?? 0,
            polygonScan: zone.polygon ?? null,
          });
        }
        void handleImport(next);
      },
      (error) => {
        if (alive) setErrorMessage(error?.message ?? missingFileS);
      }
    );
    return () => {
      alive = false;
    };
    // the resource is read once per opening
  }, [open, scanResource]);

  // mesh preview object URL
  useEffect(() => {
    if (!imported?.preview?.blob) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(imported.preview.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imported]);

  // point cloud preview: top-down projection of the sample for the chosen
  // vertical axis, in the image mode of the future base map
  useEffect(() => {
    if (!sample) {
      setPointPreview(null);
      return undefined;
    }
    let alive = true,
      url = null;
    buildLocalScanZonePreview(sample, up, imageMode).then(
      (next) => {
        url = next.url;
        if (!alive) return URL.revokeObjectURL(url);
        setPointPreview(next);
      },
      (error) => {
        if (alive) setErrorMessage(error?.message);
      }
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sample, up, imageMode]);

  // a converted mesh that leaves the dialog without a base map is deleted
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

  const bbox = isPoints ? pointPreview?.bbox : imported?.descriptor?.bbox;
  const wholePolygon = bbox ? getScene3dBboxPolygon(bbox) : null;
  const currentZone =
    wholePolygon &&
    getZoneFromPolygon(
      zoneValue.polygonScan ?? wholePolygon,
      zoneValue.rotationDeg
    );
  const zoneEditorProps = isPoints
    ? pointPreview && {
        previewUrl: pointPreview.url,
        previewSize: pointPreview.size,
        bbox: pointPreview.bbox,
        pxPerMeter: pointPreview.pxPerMeter,
      }
    : imported &&
      previewUrl && {
        previewUrl,
        previewSize: {
          width: imported.preview.width,
          height: imported.preview.height,
        },
        bbox,
        pxPerMeter: imported.preview.pxPerMeter,
      };

  // handlers

  function handleFilesChange(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    handleFiles(files);
  }

  // Drop of files and / or folders (the folder tree is walked through the
  // entries API — must run synchronously from the drop event).
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (isImporting) return;
    readDroppedEntries(event.dataTransfer)
      .then((entries) => handleFiles(entries.map((entry) => entry.file)))
      .catch((error) => {
        console.error("[scene3d] drop failed", error);
        setErrorMessage(error?.message ?? "Le dépôt a échoué.");
      });
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!dragOver && !isImporting) setDragOver(true);
  }

  function handleDragLeave(event) {
    // leaving for a child of the zone is not leaving the zone
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDragOver(false);
  }

  async function handleFiles(files) {
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
      const faceCount =
        header.elements.find((element) => element.name === "face")?.count ?? 0;
      if (faceCount > 0) {
        const { textureFiles, missingNames } = matchScene3dFiles(
          header.textureNames,
          imageFiles
        );
        const usedFiles = textureFiles.filter(Boolean);
        setSelection({
          kind: "MESH",
          plyFile,
          imageFiles: usedFiles,
          textureCount: header.textureNames.length,
          missingNames,
          totalBytes: usedFiles.reduce((sum, f) => sum + f.size, plyFile.size),
        });
      } else {
        if (isReload) {
          setSelection(null);
          setErrorMessage(reloadPointsS);
          return;
        }
        setSelection({
          kind: "POINTS",
          plyFile,
          resource: null,
          vertexCount:
            header.elements.find((element) => element.name === "vertex")
              ?.count ?? null,
          totalBytes: plyFile.size,
        });
      }
      if (!name) setName(stripExtension(plyFile.name));
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
    await handleImport(selection);
  }

  async function handleImport(current) {
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage(null);
    if (current.kind === "POINTS") {
      setImportProgress({ step: "SAMPLE", ratio: 0 });
      try {
        const next = await readLocalScanSample(current.plyFile, {
          signal: controller.signal,
          onProgress: (ratio) => setImportProgress({ step: "SAMPLE", ratio }),
        });
        setSample(next);
        setStep("ZONE");
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("[scene3d] point cloud sample failed", error);
          setErrorMessage(error?.message ?? "La lecture du nuage a échoué.");
        }
      } finally {
        setImportProgress(null);
        abortRef.current = null;
      }
      return;
    }
    setImportProgress({ step: "MESH", ratio: 0 });
    try {
      const result = await importScene3dFilesService({
        plyFile: current.plyFile,
        imageFiles: current.imageFiles,
        projectId,
        onProgress: setImportProgress,
        signal: controller.signal,
      });
      if (isReload) {
        await handleReload(result);
      } else {
        setImported({ ...result, imageFiles: current.imageFiles });
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

  function handleUpChange(_event, next) {
    if (!next || next === up) return;
    // The drawn polygon belongs to the previous horizontal frame.
    setZoneValue({ rotationDeg: 0, polygonScan: null });
    setPointPreview(null);
    setUp(next);
  }

  async function handleCreateClick() {
    if (!canCreate) return;
    if (isPoints) {
      await handleCreatePoints();
      return;
    }
    if (!imported) return;
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

  // Point cloud: the zone (source units, localScanZone.js) is decoded and
  // projected over its whole height in the preview image mode.
  async function handleCreatePoints() {
    if (!pointPreview || !sample) return;
    const zone = {
      up,
      polygon: zoneValue.polygonScan,
      rotationDeg: zoneValue.rotationDeg ?? 0,
      // scan floor = scene zero height (recentred on the zone)
      baseZ: pointPreview.floor,
      recenter: true,
    };
    const controller = new AbortController();
    abortRef.current = controller;
    setStep("FINALIZE");
    setErrorMessage(null);
    setFinalizeProgress({ step: "DECODE", ratio: 0 });
    try {
      const entity = await createScanBaseMapFromZoneService({
        source: selection.plyFile,
        resource: selection.resource,
        zone,
        wholePolygon,
        mode: imageMode,
        name: name.trim(),
        listing,
        projectId,
        axesYawDeg,
        createBaseMapFromImage,
        onProgress: setFinalizeProgress,
        signal: controller.signal,
      });
      setFinalizeProgress({ step: "CREATE", ratio: 1 });
      onCreated?.(entity);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("[localScans] base map creation failed", error);
      const message = error?.message ?? "La création du fond de plan a échoué.";
      setErrorMessage(message);
      dispatch(setToaster({ message, isError: true }));
      setStep("ZONE");
    } finally {
      setFinalizeProgress(null);
      abortRef.current = null;
    }
  }

  // render

  const importRatio = getProgressRatio(IMPORT_STEP_RANGES, importProgress);
  const finalizeRatio = getProgressRatio(
    FINALIZE_STEP_RANGES,
    finalizeProgress
  );

  const selectionInfoS = selection
    ? isPoints
      ? `${pointsS}${
          selection.vertexCount
            ? ` · ${selection.vertexCount.toLocaleString("fr-FR")} points`
            : ""
        } · ${formatScene3dBytes(selection.totalBytes)}`
      : `${selection.imageFiles.length} / ${selection.textureCount} textures · ${formatScene3dBytes(selection.totalBytes)}`
    : "";

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

      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          p: 2,
          borderRadius: "12px",
          border: "2px dashed",
          borderColor: dragOver ? "secondary.main" : "divider",
          bgcolor: dragOver ? "action.hover" : "transparent",
          transition: "all 0.2s ease",
          pointerEvents: isImporting ? "none" : "auto",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            color: dragOver ? "secondary.main" : "text.disabled",
          }}
        >
          {dropS}
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
        </Box>
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
            {selectionInfoS}
          </Typography>
          {!isPoints && selection.missingNames.length > 0 && (
            <Alert severity="warning" sx={{ mt: 0.5 }}>
              {`Textures manquantes (affichées sans image) : ${selection.missingNames.join(", ")}`}
            </Alert>
          )}
        </Box>
      )}

      {!isReload && !isPoints && (
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

  // point cloud: the preview of the sample is being rebuilt (axis / image
  // mode change)
  const pointPreviewPanel = (
    <Paper sx={{ p: 2, width: 360 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {errorMessage ?? "Projection de l’aperçu du nuage…"}
      </Typography>
      {!errorMessage && <LinearProgress />}
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
        {step === "ZONE" && zoneEditorProps && (
          <Box sx={{ position: "absolute", inset: 0 }}>
            <Scene3dZoneEditor
              key={isPoints ? up : "mesh"}
              {...zoneEditorProps}
              value={zoneValue}
              onChange={setZoneValue}
            />
          </Box>
        )}
        {step === "ZONE" && isPoints && !zoneEditorProps && pointPreviewPanel}

        {step === "FILES" && filesPanel}
        {step === "FINALIZE" && finalizePanel}

        {step === "ZONE" && isPoints && sample && (
          <Box
            sx={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
            }}
          >
            <Paper sx={{ px: 2, py: 1, maxWidth: 420 }}>
              <Typography variant="subtitle2">{titleS}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {selection.plyFile.name}
                {` · aperçu ${sample.count.toLocaleString("fr-FR")} / ${sample.sourceCount.toLocaleString("fr-FR")} points`}
              </Typography>
              {sample.kind === "SPLAT" && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  {splatS}
                </Typography>
              )}
            </Paper>
          </Box>
        )}

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
              {isPoints && (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" noWrap>
                      {upS}
                    </Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={up}
                      onChange={handleUpChange}
                    >
                      <ToggleButton value="Z">Z</ToggleButton>
                      <ToggleButton value="Y">Y</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" noWrap>
                      {imageModeS}
                    </Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={imageMode}
                      onChange={(_e, next) => next && setImageMode(next)}
                    >
                      <ToggleButton value="density">{densityS}</ToggleButton>
                      <ToggleButton value="rgb">{rgbS}</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                </>
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
                disabled={!canCreate || (isPoints && !pointPreview)}
                onClick={handleCreateClick}
              />
            </Paper>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
