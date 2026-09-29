import { useState } from "react";

import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  Typography,
} from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DropZonePromptIaProject from "./DropZonePromptIaProject";

import readPromptIaProjectOutputZip from "../services/readPromptIaProjectOutputZip";

const plural = (count, one, many) => `${count} ${count > 1 ? many : one}`;

export default function SectionPromptIaProjectOutput({
  project,
  creation,
  onLoaded,
  onDone,
}) {
  // strings

  const titleS = "2. Importer le résultat";
  const dropS = "Glisser & déposer le zip renvoyé par le chat IA";
  const dropSubS = "projet.json + PDFs des fonds de plan";
  const createS = "Créer";
  const closeS = "Fermer";
  const missingProjectS = "Renseignez le nom et le numéro du projet.";
  const doneS = "Projet créé";

  // data

  const { create, running, progress, result, error: creationError } = creation;

  // state

  const [reading, setReading] = useState(false);
  const [output, setOutput] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);

  // helpers

  const hasProject =
    Boolean(project?.name?.trim()) && Boolean(project?.clientRef?.trim());
  const canCreate = Boolean(output) && hasProject && !running && !result;

  const progressPct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const summaryChips = output
    ? [
        plural(output.summary.scopes, "scope", "scopes"),
        plural(output.summary.baseMaps, "fond de plan", "fonds de plan"),
        plural(output.summary.listings, "liste", "listes"),
        plural(output.summary.templates, "modèle", "modèles"),
        plural(output.summary.annotations, "annotation", "annotations"),
      ]
    : [];

  const resultChips = result
    ? [
        plural(result.counts.scopes, "scope", "scopes"),
        plural(result.counts.baseMaps, "fond de plan", "fonds de plan"),
        plural(result.counts.templates, "modèle", "modèles"),
        plural(result.counts.annotations, "annotation", "annotations"),
        ...(result.counts.skipped > 0
          ? [
              plural(
                result.counts.skipped,
                "annotation ignorée",
                "annotations ignorées"
              ),
            ]
          : []),
      ]
    : [];

  async function loadZip(file) {
    if (!file) return;
    setReading(true);
    setError(null);
    setOutput(null);
    setFileName(file.name);
    try {
      const read = await readPromptIaProjectOutputZip(file);
      if (!read.ok) {
        setError(read.error);
        return;
      }
      setOutput(read);
      onLoaded?.(read.data);
    } catch (e) {
      console.error("[promptIaProject] output zip failed", e);
      setError(`Zip illisible : ${e?.message ?? String(e)}`);
    } finally {
      setReading(false);
    }
  }

  // handlers

  function handleDrop(dataTransfer) {
    loadZip(Array.from(dataTransfer.files ?? [])[0]);
  }

  function handleFiles(files) {
    loadZip(files[0]);
  }

  async function handleCreate() {
    if (!canCreate) return;
    await create({
      project,
      data: output.data,
      pdfFilesByPath: output.pdfFilesByPath,
    });
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle2">{titleS}</Typography>

      {!result && (
        <DropZonePromptIaProject
          label={fileName && output ? fileName : dropS}
          subLabel={dropSubS}
          onDrop={handleDrop}
          onFiles={handleFiles}
          accept=".zip,application/zip"
          loading={reading}
          disabled={running}
        />
      )}

      {Boolean(error) && <Alert severity="error">{error}</Alert>}

      {output && !result && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {summaryChips.map((label) => (
            <Chip key={label} label={label} size="small" />
          ))}
        </Box>
      )}

      {Boolean(output?.data?.note) && !result && (
        <Alert severity="info">{output.data.note}</Alert>
      )}

      {output && !hasProject && !result && (
        <Alert severity="warning">{missingProjectS}</Alert>
      )}

      {running && (
        <Box>
          <LinearProgress variant="determinate" value={progressPct} />
          <Typography variant="caption" color="text.secondary" noWrap>
            {`${progress.step} (${progress.done}/${progress.total})`}
          </Typography>
        </Box>
      )}

      {Boolean(creationError) && (
        <Alert severity="error">{creationError}</Alert>
      )}

      {result && (
        <>
          <Alert severity={result.errors.length ? "warning" : "success"}>
            {doneS}
          </Alert>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {resultChips.map((label) => (
              <Chip key={label} label={label} size="small" />
            ))}
          </Box>
          {result.errors.length > 0 && (
            <Box
              sx={{
                maxHeight: 140,
                overflowY: "auto",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1,
              }}
            >
              {result.errors.map((message, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  color="error"
                  sx={{ display: "block" }}
                >
                  {message}
                </Typography>
              ))}
            </Box>
          )}
        </>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        {result ? (
          <ButtonGeneric
            label={closeS}
            onClick={() => onDone(result.projectId)}
            variant="contained"
            color="secondary"
          />
        ) : (
          <ButtonGeneric
            label={
              running
                ? `Création… (${progress.done}/${progress.total})`
                : createS
            }
            onClick={handleCreate}
            variant="contained"
            color="secondary"
            disabled={!canCreate}
            startIcon={
              running ? <CircularProgress size={14} color="inherit" /> : null
            }
          />
        )}
      </Box>
    </Box>
  );
}
