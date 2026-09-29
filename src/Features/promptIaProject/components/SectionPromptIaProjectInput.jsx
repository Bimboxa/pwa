import { useState } from "react";

import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { Close, Download } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DropZonePromptIaProject from "./DropZonePromptIaProject";

import buildPromptIaProjectZip from "../services/buildPromptIaProjectZip";
import readDroppedEntries from "../utils/readDroppedEntries";
import expandZipFiles, { mergeEntries } from "../utils/expandZipFiles";
import formatFileSize from "../utils/formatFileSize";

const MAX_DESCRIPTION_LENGTH = 4000;

export default function SectionPromptIaProjectInput({ project, disabled }) {
  // strings

  const titleS = "1. Préparer le prompt";
  const dropS = "Glisser & déposer des fichiers, dossiers ou zips";
  const dropSubS =
    "Plans PDF, images, notes… ou cliquer pour choisir des fichiers";
  const descriptionS = "Description des scopes à créer";
  const descriptionPlaceholderS =
    "Ex. : un scope « Gros œuvre » avec les murs et poteaux du RDC et du R+1, un scope « Étanchéité » avec les surfaces de toiture terrasse.";
  const downloadS = "Télécharger le zip";
  const hintS =
    "Déposez ensuite ce zip dans un chat IA (ChatGPT, Claude…) : il vous renverra un zip à importer à l'étape 2.";

  // state

  const [entries, setEntries] = useState([]);
  const [description, setDescription] = useState("");
  const [reading, setReading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  const [downloaded, setDownloaded] = useState(null);

  // helpers

  const totalSize = entries.reduce((n, e) => n + (e.file.size ?? 0), 0);
  const canDownload =
    Boolean(description.trim()) && !reading && !building && !disabled;

  async function addEntries(readEntries) {
    setReading(true);
    setError(null);
    try {
      const added = await expandZipFiles(await readEntries);
      setEntries((current) => mergeEntries(current, added));
      setDownloaded(null);
    } catch (e) {
      console.error("[promptIaProject] read failed", e);
      setError(`Lecture impossible : ${e?.message ?? String(e)}`);
    } finally {
      setReading(false);
    }
  }

  // handlers

  function handleDrop(dataTransfer) {
    // the entries must be read before the first await
    addEntries(readDroppedEntries(dataTransfer));
  }

  function handleFiles(files) {
    addEntries(files.map((file) => ({ path: file.name, file })));
  }

  function handleRemove(path) {
    setEntries((current) => current.filter((e) => e.path !== path));
    setDownloaded(null);
  }

  async function handleDownload() {
    if (!canDownload) return;
    setBuilding(true);
    setError(null);
    try {
      setDownloaded(
        await buildPromptIaProjectZip({ project, description, entries })
      );
    } catch (e) {
      console.error("[promptIaProject] zip failed", e);
      setError(`Zip impossible : ${e?.message ?? String(e)}`);
    } finally {
      setBuilding(false);
    }
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle2">{titleS}</Typography>

      <DropZonePromptIaProject
        label={dropS}
        subLabel={dropSubS}
        onDrop={handleDrop}
        onFiles={handleFiles}
        multiple
        loading={reading}
        disabled={disabled}
      />

      {entries.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            {`${entries.length} fichier(s) — ${formatFileSize(totalSize)}`}
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              maxHeight: 140,
              overflowY: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            {entries.map((entry) => (
              <Box
                key={entry.path}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  pl: 1,
                  minHeight: 28,
                }}
              >
                <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                  {entry.path}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flexShrink: 0 }}
                >
                  {formatFileSize(entry.file.size)}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleRemove(entry.path)}
                  disabled={disabled}
                >
                  <Close sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <TextField
        label={descriptionS}
        placeholder={descriptionPlaceholderS}
        value={description}
        onChange={(e) =>
          setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))
        }
        // keep the dialog shortcuts (Escape aside) away from the text
        onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}
        multiline
        minRows={3}
        maxRows={8}
        size="small"
        fullWidth
        disabled={disabled}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <ButtonGeneric
          label={downloadS}
          onClick={handleDownload}
          variant="outlined"
          size="small"
          disabled={!canDownload}
          startIcon={building ? <CircularProgress size={14} /> : <Download />}
        />
        {downloaded && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {`${downloaded.fileName} — ${formatFileSize(downloaded.sizeBytes)}`}
          </Typography>
        )}
      </Box>

      {downloaded?.unreadablePdfs?.length > 0 && (
        <Alert severity="warning">
          {`PDF illisible(s), joint(s) tel(s) quel(s) : ${downloaded.unreadablePdfs.join(", ")}`}
        </Alert>
      )}
      {Boolean(error) && <Alert severity="error">{error}</Alert>}

      <Typography variant="caption" color="text.secondary">
        {hintS}
      </Typography>
    </Box>
  );
}
