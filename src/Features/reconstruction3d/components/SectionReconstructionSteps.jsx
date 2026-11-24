import { useRef, useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { bumpReconstructionVideoVersion } from "../reconstruction3dSlice";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Typography,
} from "@mui/material";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import VideoCallOutlined from "@mui/icons-material/VideoCallOutlined";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import readDroppedEntries from "Features/promptIaProject/utils/readDroppedEntries";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import { readPhotoFilesFromEntries } from "Features/orthophotos/services/orthophotoPromptServices";
import { RECONSTRUCTION_MEDIA_TYPES } from "../constants/reconstruction3dTool";
import extractVideoFramesService from "../services/extractVideoFramesService";
import {
  addReconstructionFramesService,
  clearReconstructionMediaService,
  hasReconstructionPose,
  setReconstructionMediaService,
} from "../services/reconstructionFramesServices";
import {
  applyReconstructionResultService,
  buildReconstructionPromptZip,
  readReconstructionResultZip,
} from "../services/reconstructionPromptServices";

const MEDIA_ACCEPT =
  "image/png,image/jpeg,image/webp,.zip,video/*,.mov,.mp4,.m4v,.webm";
const VIDEO_EXTENSIONS = /\.(mov|mp4|m4v|webm|mkv|avi)$/i;

const isVideoEntry = (entry) =>
  entry?.file?.type?.startsWith("video/") ||
  VIDEO_EXTENSIONS.test(entry?.path ?? "") ||
  VIDEO_EXTENSIONS.test(entry?.file?.name ?? "");

function StepTitle({ index, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
      <Box
        sx={{
          width: 18,
          height: 18,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          bgcolor: "text.secondary",
          color: "common.white",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {index}
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {children}
      </Typography>
    </Box>
  );
}

function DropZone({ icon, label, hint, busy, onDropEntries, onClick }) {
  // state

  const [hover, setHover] = useState(false);

  // handlers

  function handleDrop(e) {
    e.preventDefault();
    setHover(false);
    if (busy) return;
    // synchronous: the DataTransfer items die with the event
    const entriesPromise = readDroppedEntries(e.dataTransfer);
    onDropEntries(entriesPromise);
  }

  // render

  return (
    <Box
      onClick={busy ? undefined : onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={handleDrop}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        p: 1.25,
        borderRadius: 1,
        border: "1.5px dashed",
        borderColor: hover ? "primary.main" : "divider",
        bgcolor: hover ? "action.hover" : "transparent",
        cursor: busy ? "progress" : "pointer",
        transition: "0.15s",
      }}
    >
      {busy ? <CircularProgress size={20} /> : icon}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      </Box>
    </Box>
  );
}

// The 3 steps of the Reconstruction 3D tool — the Prompt IA round trip that
// rebuilds the scene of a reconstruction base map:
//   1. drop a video (it is sampled into timestamped frames, in the browser)
//      or photos (files, a folder, a zip);
//   2. download the prompt zip (instructions + images) and hand it to an AI
//      chat;
//   3. drop the zip the AI returns: the GLB becomes the model and the image
//      of the base map, each image gets its camera.
// See services/reconstructionPromptServices.
export default function SectionReconstructionSteps({ baseMap, frames }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Reconstruire la scène";
  const step1S = "Déposer une vidéo ou des photos";
  const dropMediaS = "Glisser une vidéo, des photos, un dossier ou un zip";
  const dropMediaHintS = "MP4, MOV, JPEG, PNG, WebP — ou cliquer pour choisir";
  const folderS = "Choisir un dossier";
  const step2S = "Générer le prompt IA";
  const downloadS = "Télécharger le zip du prompt";
  const downloadHelpS =
    "Donnez ce zip à un chat IA : il renvoie un zip contenant le modèle 3D (GLB) et la caméra de chaque image.";
  const step3S = "Déposer le zip renvoyé par l'IA";
  const dropResultS = "Glisser le zip de l'IA";
  const dropResultHintS = "reconstruction.json + modèle GLB";
  const noMediaS = "Aucune vidéo ni photo n'a été trouvée dans le dépôt.";
  const extractingS = "Extraction des images de la vidéo…";
  const storingS = "Enregistrement des images…";
  const replaceVideoS =
    "Les images actuelles et leurs caméras seront remplacées par celles de la nouvelle vidéo.";
  const replacePhotosS =
    "Les images de la vidéo et leurs caméras seront remplacées par les photos.";

  // state

  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const resultInputRef = useRef(null);
  // {label, ratio} while a video is sampled / the images stored
  const [adding, setAdding] = useState(null);
  const [building, setBuilding] = useState(false);
  const [applying, setApplying] = useState(false);
  const [zipInfo, setZipInfo] = useState(null);
  const [report, setReport] = useState(null);
  // media waiting for the « replace the images » confirmation
  const [pendingMedia, setPendingMedia] = useState(null);

  // helpers

  const mediaType = baseMap.reconstruction3d?.mediaType ?? null;
  const posedCount = frames.filter(hasReconstructionPose).length;
  const countsS =
    frames.length === 0
      ? "Aucune image pour l'instant."
      : `${frames.length} image(s)${
          mediaType === RECONSTRUCTION_MEDIA_TYPES.VIDEO ? " de la vidéo" : ""
        }, dont ${posedCount} avec caméra.`;

  const toast = (message, severity = "info") =>
    dispatch(setToaster({ message, severity }));

  const inputEntries = (e) => {
    const entries = Array.from(e.target.files ?? []).map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
    e.target.value = "";
    return entries;
  };

  const baseMapRef = {
    id: baseMap.id,
    projectId: baseMap.projectId,
    listingId: baseMap.listingId,
  };

  // handlers

  // Step 1, part 1: what was dropped. A video replaces everything; photos
  // are added to the photos already there (and replace the frames of a
  // video). Replacing asks first.
  async function handleMediaEntries(entriesOrPromise) {
    if (adding) return;
    setAdding({ label: "", ratio: null });
    let waitsForChoice = false;
    try {
      const entries = await entriesOrPromise;
      const videoFile = entries.find(isVideoEntry)?.file ?? null;
      let media;
      if (videoFile) {
        media = { type: RECONSTRUCTION_MEDIA_TYPES.VIDEO, videoFile };
      } else {
        const { files, skipped } = await readPhotoFilesFromEntries(entries);
        if (files.length === 0) {
          toast(noMediaS, "warning");
          return;
        }
        media = { type: RECONSTRUCTION_MEDIA_TYPES.PHOTOS, files, skipped };
      }
      const replaces =
        frames.length > 0 &&
        (media.type === RECONSTRUCTION_MEDIA_TYPES.VIDEO ||
          mediaType === RECONSTRUCTION_MEDIA_TYPES.VIDEO);
      if (replaces) {
        waitsForChoice = true;
        setPendingMedia(media);
        return;
      }
      await addMedia(media, { replace: false });
    } catch (e) {
      reportAddError(e);
    } finally {
      if (!waitsForChoice) setAdding(null);
    }
  }

  // Step 1, part 2: the confirmation of the replacement.
  async function handleReplaceConfirm() {
    const media = pendingMedia;
    setPendingMedia(null);
    if (!media) {
      setAdding(null);
      return;
    }
    try {
      await addMedia(media, { replace: true });
    } catch (e) {
      reportAddError(e);
    } finally {
      setAdding(null);
    }
  }

  function handleReplaceCancel() {
    setPendingMedia(null);
    setAdding(null);
  }

  function reportAddError(e) {
    console.error("[reconstruction3d] add media failed", e);
    toast(`Images non ajoutées : ${e?.message ?? e}`, "error");
  }

  async function addMedia(media, { replace }) {
    if (media.type === RECONSTRUCTION_MEDIA_TYPES.VIDEO) {
      // sampled BEFORE anything is replaced: an unreadable video leaves the
      // base map as it was
      setAdding({ label: extractingS, ratio: 0 });
      const extracted = await extractVideoFramesService({
        file: media.videoFile,
        onProgress: (ratio) => setAdding({ label: extractingS, ratio }),
      });
      if (replace) await clearReconstructionMediaService(baseMap.id);
      setAdding({ label: storingS, ratio: 0 });
      const rows = await addReconstructionFramesService({
        baseMap: baseMapRef,
        items: extracted.frames,
        onProgress: (ratio) => setAdding({ label: storingS, ratio }),
      });
      await setReconstructionMediaService({
        baseMapId: baseMap.id,
        projectId: baseMap.projectId,
        mediaType: RECONSTRUCTION_MEDIA_TYPES.VIDEO,
        videoFile: media.videoFile,
        videoInfo: extracted,
      });
      dispatch(bumpReconstructionVideoVersion());
      toast(
        `${rows.length} image(s) extraite(s) de la vidéo (une toutes les ${extracted.intervalS.toFixed(2)} s).`,
        "success"
      );
    } else {
      if (replace) await clearReconstructionMediaService(baseMap.id);
      setAdding({ label: storingS, ratio: 0 });
      const rows = await addReconstructionFramesService({
        baseMap: baseMapRef,
        items: media.files.map((file) => ({ file })),
        onProgress: (ratio) => setAdding({ label: storingS, ratio }),
      });
      if (replace || mediaType !== RECONSTRUCTION_MEDIA_TYPES.PHOTOS) {
        await setReconstructionMediaService({
          baseMapId: baseMap.id,
          projectId: baseMap.projectId,
          mediaType: RECONSTRUCTION_MEDIA_TYPES.PHOTOS,
        });
      }
      toast(
        `${rows.length} photo(s) ajoutée(s)${
          media.skipped.length
            ? ` — ${media.skipped.length} fichier(s) ignoré(s) (format non pris en charge)`
            : ""
        }`,
        media.skipped.length ? "warning" : "success"
      );
    }
    setZipInfo(null);
    dispatch(triggerBaseMapsUpdate());
  }

  async function handleDownload() {
    if (building) return;
    setBuilding(true);
    try {
      const result = await buildReconstructionPromptZip({ baseMap });
      if (!result.ok) {
        toast(result.error, "warning");
        return;
      }
      setZipInfo(result);
      if (result.missing.length > 0) {
        toast(
          `${result.missing.length} image(s) absente(s) de cet appareil : hors du zip.`,
          "warning"
        );
      }
    } catch (e) {
      console.error("[reconstruction3d] prompt zip failed", e);
      toast(`Zip non généré : ${e?.message ?? e}`, "error");
    } finally {
      setBuilding(false);
    }
  }

  async function handleResultEntries(entriesOrPromise) {
    if (applying) return;
    setApplying(true);
    setReport(null);
    try {
      const entries = await entriesOrPromise;
      const file = entries.find((entry) => /\.zip$/i.test(entry.path))?.file;
      if (!file) {
        setReport({ severity: "warning", lines: ["Déposez un fichier zip."] });
        return;
      }
      const read = await readReconstructionResultZip(file, {
        baseMapId: baseMap.id,
      });
      if (!read.ok) {
        setReport({ severity: "error", lines: [read.error] });
        return;
      }
      const applied = await applyReconstructionResultService({
        baseMapId: baseMap.id,
        data: read.data,
        modelFile: read.modelFile,
      });
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
      dispatch(triggerBaseMapsUpdate());

      const lines = [
        `Modèle 3D chargé : ${applied.posed} image(s) avec caméra sur ${frames.length}.`,
      ];
      if (applied.unposed.length > 0)
        lines.push(
          `Sans caméra : ${applied.unposed.slice(0, 12).join(", ")}${
            applied.unposed.length > 12 ? "…" : ""
          }.`
        );
      if (applied.frameChanged && applied.hadAnnotations)
        lines.push(
          "Le cadre du fond de plan a changé : vérifiez la position des annotations existantes."
        );
      if (!applied.scaleIsMetric)
        lines.push(
          "Échelle estimée par l'IA : calibrez le fond de plan pour mesurer."
        );
      if (read.data.note) lines.push(`Note de l'IA : ${read.data.note}`);
      lines.push(...read.data.warnings);
      setReport({
        severity:
          applied.unposed.length > 0 ||
          read.data.warnings.length > 0 ||
          (applied.frameChanged && applied.hadAnnotations)
            ? "warning"
            : "success",
        lines,
      });
      setZipInfo(null);
    } catch (e) {
      console.error("[reconstruction3d] result import failed", e);
      setReport({
        severity: "error",
        lines: [`Import impossible : ${e?.message ?? e}`],
      });
    } finally {
      setApplying(false);
    }
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {titleS}
      </Typography>

      {/* 1. video / photos */}
      <StepTitle index={1}>{step1S}</StepTitle>
      <DropZone
        icon={<VideoCallOutlined color="action" />}
        label={dropMediaS}
        hint={dropMediaHintS}
        busy={Boolean(adding)}
        onDropEntries={handleMediaEntries}
        onClick={() => filesInputRef.current?.click()}
      />
      {adding?.label && (
        <Box sx={{ mt: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            {adding.label}
          </Typography>
          <LinearProgress
            variant={adding.ratio == null ? "indeterminate" : "determinate"}
            value={(adding.ratio ?? 0) * 100}
          />
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mt: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {countsS}
        </Typography>
        <Button
          size="small"
          color="inherit"
          startIcon={<FolderOpenOutlined sx={{ fontSize: 16 }} />}
          disabled={Boolean(adding)}
          onClick={() => folderInputRef.current?.click()}
          sx={{ flexShrink: 0 }}
        >
          {folderS}
        </Button>
      </Box>
      <input
        ref={filesInputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        hidden
        onChange={(e) => handleMediaEntries(inputEntries(e))}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        multiple
        hidden
        onChange={(e) => handleMediaEntries(inputEntries(e))}
      />

      {/* 2. prompt zip */}
      <Box sx={{ mt: 1.5 }}>
        <StepTitle index={2}>{step2S}</StepTitle>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={
            building ? <CircularProgress size={14} /> : <DownloadOutlined />
          }
          disabled={building || frames.length === 0}
          onClick={handleDownload}
        >
          {downloadS}
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
        >
          {zipInfo
            ? `${zipInfo.fileName} — ${zipInfo.framesCount} image(s), ${stringifyFileSize(zipInfo.sizeBytes)}`
            : downloadHelpS}
        </Typography>
      </Box>

      {/* 3. result zip */}
      <Box sx={{ mt: 1.5 }}>
        <StepTitle index={3}>{step3S}</StepTitle>
        <DropZone
          icon={<UploadFileOutlined color="action" />}
          label={dropResultS}
          hint={dropResultHintS}
          busy={applying}
          onDropEntries={handleResultEntries}
          onClick={() => resultInputRef.current?.click()}
        />
        <input
          ref={resultInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => handleResultEntries(inputEntries(e))}
        />
        {report && (
          <Alert
            severity={report.severity}
            onClose={() => setReport(null)}
            sx={{ mt: 1, py: 0, "& .MuiAlert-message": { minWidth: 0 } }}
          >
            {report.lines.map((line, index) => (
              <Typography
                key={index}
                variant="caption"
                sx={{ display: "block", overflowWrap: "anywhere" }}
              >
                {line}
              </Typography>
            ))}
          </Alert>
        )}
      </Box>

      <DialogDeleteRessource
        open={Boolean(pendingMedia)}
        message={
          pendingMedia?.type === RECONSTRUCTION_MEDIA_TYPES.VIDEO
            ? replaceVideoS
            : replacePhotosS
        }
        onClose={handleReplaceCancel}
        onConfirmAsync={handleReplaceConfirm}
      />
    </WhiteSectionGeneric>
  );
}
