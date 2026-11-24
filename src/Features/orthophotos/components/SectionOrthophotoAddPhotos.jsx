import { useRef, useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { setHiddenVersionIds } from "Features/baseMapEditor/baseMapEditorSlice";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import readDroppedEntries from "Features/promptIaProject/utils/readDroppedEntries";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import { isPendingOrthophoto } from "../services/orthophotoServices";
import {
  addPendingPhotosService,
  applyOrthophotoResultService,
  buildOrthophotoPromptZip,
  readOrthophotoResultZip,
  readPhotoFilesFromEntries,
} from "../services/orthophotoPromptServices";

const PHOTOS_ACCEPT = "image/png,image/jpeg,image/webp,.zip";

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

// « Ajouter des photos » of the Orthophotos tool — the Prompt IA round trip
// that builds (or extends) the mosaic of the orthomosaic base map:
//   1. drop photos (files, a folder, or a zip of photos): they are kept on
//      the base map, waiting to be rectified;
//   2. download the prompt zip (instructions + photos + current mosaic) and
//      hand it to an AI chat;
//   3. drop the zip the AI returns: the base map image and the orthophotos
//      are updated.
// See services/orthophotoPromptServices.
export default function SectionOrthophotoAddPhotos({ baseMap, orthophotos }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Ajouter des photos";
  const step1S = "Déposer les photos";
  const dropPhotosS = "Glisser des photos, un dossier ou un zip";
  const dropPhotosHintS = "JPEG, PNG ou WebP — ou cliquer pour choisir";
  const folderS = "Choisir un dossier";
  const step2S = "Générer le prompt IA";
  const downloadS = "Télécharger le zip du prompt";
  const downloadHelpS =
    "Donnez ce zip à un chat IA : il renvoie un zip contenant la mosaïque et les orthophotos unitaires.";
  const step3S = "Déposer le zip renvoyé par l'IA";
  const dropResultS = "Glisser le zip de l'IA";
  const dropResultHintS = "orthophoto.json + mosaïque + orthophotos unitaires";
  const noPhotoS = "Aucune photo n'a été trouvée dans le dépôt.";

  // state

  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const resultInputRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [building, setBuilding] = useState(false);
  const [applying, setApplying] = useState(false);
  const [zipInfo, setZipInfo] = useState(null);
  const [report, setReport] = useState(null);

  // helpers

  const pendingCount = orthophotos.filter(isPendingOrthophoto).length;
  const excludedCount = orthophotos.filter((o) => o.isExcluded).length;
  // photos that go in the prompt zip: with an original image, not excluded
  const withSourceCount = orthophotos.filter(
    (o) => o.sourceImage?.fileName && !o.isExcluded
  ).length;
  const countsS =
    orthophotos.length === 0
      ? "Aucune photo pour l'instant."
      : `${orthophotos.length} photo(s), dont ${pendingCount} à assembler${
          excludedCount ? ` et ${excludedCount} écartée(s)` : ""
        }.`;

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

  // handlers

  async function handleAddEntries(entriesOrPromise) {
    if (adding) return;
    setAdding(true);
    try {
      const entries = await entriesOrPromise;
      const { files, skipped } = await readPhotoFilesFromEntries(entries);
      if (files.length === 0) {
        toast(noPhotoS, "warning");
        return;
      }
      const rows = await addPendingPhotosService({
        baseMap: {
          id: baseMap.id,
          projectId: baseMap.projectId,
          listingId: baseMap.listingId,
        },
        files,
      });
      setZipInfo(null);
      toast(
        `${rows.length} photo(s) ajoutée(s)${
          skipped.length
            ? ` — ${skipped.length} fichier(s) ignoré(s) (format non pris en charge)`
            : ""
        }`,
        skipped.length ? "warning" : "success"
      );
    } catch (e) {
      console.error("[orthophotos] add photos failed", e);
      toast(`Photos non ajoutées : ${e?.message ?? e}`, "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDownload() {
    if (building) return;
    setBuilding(true);
    try {
      const result = await buildOrthophotoPromptZip({ baseMap });
      if (!result.ok) {
        toast(result.error, "warning");
        return;
      }
      setZipInfo(result);
      if (result.missing.length > 0) {
        toast(
          `${result.missing.length} photo(s) sans image d'origine sur cet appareil : absente(s) du zip.`,
          "warning"
        );
      }
    } catch (e) {
      console.error("[orthophotos] prompt zip failed", e);
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
      const read = await readOrthophotoResultZip(file, {
        baseMapId: baseMap.id,
      });
      if (!read.ok) {
        setReport({ severity: "error", lines: [read.error] });
        return;
      }
      const applied = await applyOrthophotoResultService({
        baseMapId: baseMap.id,
        data: read.data,
        filesByPath: read.filesByPath,
      });
      dispatch(setHiddenVersionIds(applied.inactiveVersionIds));
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
      dispatch(triggerBaseMapsUpdate());

      const lines = [
        `Fond de plan mis à jour : ${applied.updated} orthophoto(s) assemblée(s).`,
      ];
      if (applied.pending.length > 0)
        lines.push(`Non assemblée(s) : ${applied.pending.join(", ")}.`);
      if (applied.frameChanged && applied.hadAnnotations)
        lines.push(
          "Le cadre de la mosaïque a changé : vérifiez la position des annotations existantes."
        );
      if (!applied.scaleKept)
        lines.push("Échelle non définie : calibrez le fond de plan.");
      if (read.data.note) lines.push(`Note de l'IA : ${read.data.note}`);
      lines.push(...read.data.warnings);
      setReport({
        severity:
          applied.pending.length > 0 ||
          read.data.warnings.length > 0 ||
          (applied.frameChanged && applied.hadAnnotations)
            ? "warning"
            : "success",
        lines,
      });
      setZipInfo(null);
    } catch (e) {
      console.error("[orthophotos] result import failed", e);
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

      {/* 1. photos */}
      <StepTitle index={1}>{step1S}</StepTitle>
      <DropZone
        icon={<AddPhotoAlternateOutlined color="action" />}
        label={dropPhotosS}
        hint={dropPhotosHintS}
        busy={adding}
        onDropEntries={handleAddEntries}
        onClick={() => filesInputRef.current?.click()}
      />
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
          disabled={adding}
          onClick={() => folderInputRef.current?.click()}
          sx={{ flexShrink: 0 }}
        >
          {folderS}
        </Button>
      </Box>
      <input
        ref={filesInputRef}
        type="file"
        accept={PHOTOS_ACCEPT}
        multiple
        hidden
        onChange={(e) => handleAddEntries(inputEntries(e))}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        multiple
        hidden
        onChange={(e) => handleAddEntries(inputEntries(e))}
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
          disabled={building || withSourceCount === 0}
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
            ? `${zipInfo.fileName} — ${zipInfo.photosCount} photo(s), ${stringifyFileSize(zipInfo.sizeBytes)}`
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
    </WhiteSectionGeneric>
  );
}
