import { useEffect, useRef } from "react";

import { Alert, Box, Chip, LinearProgress, Typography } from "@mui/material";

import FormProject from "Features/projects/components/FormProject";
import DropZonePromptIaProject from "./DropZonePromptIaProject";

const plural = (count, one, many) => `${count} ${count > 1 ? many : one}`;

export default function StepPromptIaProjectResult({
  project,
  onProjectChange,
  creation,
  output: outputState,
  hasProject,
}) {
  // strings

  const dropS = "Glisser & déposer le zip renvoyé par le chat IA";
  const dropSubS =
    "projet.json + PDFs des fonds de plan (+ image satellite, documents) — ou coller le fichier (Ctrl/Cmd+V)";
  const previewS = "Aperçu";
  const missingProjectS = "Renseignez le nom et le numéro du projet.";
  const doneS = "Projet créé";
  const referenceLabelByType = {
    SATELLITE: "Référence : image satellite",
    BASE_MAP: "Référence : fond de plan",
  };

  // data

  const { running, progress, result, error: creationError } = creation;
  const { reading, output, fileName, error, loadZip } = outputState;

  // helpers

  const progressPct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const summaryChips = output
    ? [
        plural(output.summary.scopes, "scope", "scopes"),
        plural(output.summary.baseMaps, "fond de plan", "fonds de plan"),
        plural(output.summary.listings, "liste", "listes"),
        plural(output.summary.templates, "modèle", "modèles"),
        plural(output.summary.annotations, "annotation", "annotations"),
        ...(output.summary.placements > 0
          ? [
              plural(
                output.summary.placements,
                "fond à positionner",
                "fonds à positionner"
              ),
            ]
          : []),
        ...(output.summary.documents > 0
          ? [plural(output.summary.documents, "document", "documents")]
          : []),
        ...(output.summary.businessObjects > 0
          ? [plural(output.summary.businessObjects, "ouvrage", "ouvrages")]
          : []),
        ...(output.summary.issues > 0
          ? [
              plural(
                output.summary.issues,
                "point d'attention",
                "points d'attention"
              ),
            ]
          : []),
      ]
    : [];

  const site = output?.data?.site;
  const siteS = [site?.address, referenceLabelByType[site?.reference?.type]]
    .filter(Boolean)
    .join(" — ");
  const warnings = output?.data?.warnings ?? [];

  const resultChips = result
    ? [
        plural(result.counts.scopes, "scope", "scopes"),
        plural(result.counts.baseMaps, "fond de plan", "fonds de plan"),
        plural(result.counts.templates, "modèle", "modèles"),
        plural(result.counts.annotations, "annotation", "annotations"),
        ...(result.counts.placed > 0
          ? [
              plural(
                result.counts.placed,
                "fond positionné",
                "fonds positionnés"
              ),
            ]
          : []),
        ...(result.counts.documents > 0
          ? [plural(result.counts.documents, "document", "documents")]
          : []),
        ...(result.counts.businessObjects > 0
          ? [plural(result.counts.businessObjects, "ouvrage", "ouvrages")]
          : []),
        ...(result.counts.issues > 0
          ? [
              `${plural(
                result.counts.issues,
                "point d'attention",
                "points d'attention"
              )}${
                result.counts.qtyGapIssues > 0
                  ? ` (dont ${plural(
                      result.counts.qtyGapIssues,
                      "écart de quantité",
                      "écarts de quantité"
                    )})`
                  : ""
              }`,
            ]
          : []),
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

  // A zip copied in the file explorer can be pasted while the step is shown.
  const pasteRef = useRef(null);
  pasteRef.current = (e) => {
    const file = Array.from(e.clipboardData?.files ?? [])[0];
    if (!file || running || result || reading) return;
    e.preventDefault();
    loadZip(file);
  };
  useEffect(() => {
    const handlePaste = (e) => pasteRef.current(e);
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // handlers

  function handleDrop(dataTransfer) {
    loadZip(Array.from(dataTransfer.files ?? [])[0]);
  }

  function handleFiles(files) {
    loadZip(files[0]);
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
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
        <>
          <Typography variant="subtitle2">{previewS}</Typography>
          <Box sx={{ ...(running && { pointerEvents: "none", opacity: 0.6 }) }}>
            <FormProject project={project} onChange={onProjectChange} />
          </Box>
          {!hasProject && <Alert severity="warning">{missingProjectS}</Alert>}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {summaryChips.map((label) => (
              <Chip key={label} label={label} size="small" />
            ))}
          </Box>
          {Boolean(siteS) && (
            <Typography variant="caption" color="text.secondary">
              {siteS}
            </Typography>
          )}
          {Boolean(output.data.note) && (
            <Alert severity="info">{output.data.note}</Alert>
          )}
          {warnings.length > 0 && (
            <Alert severity="warning">
              {warnings.map((message, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  sx={{ display: "block" }}
                >
                  {message}
                </Typography>
              ))}
            </Alert>
          )}
        </>
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
    </Box>
  );
}
