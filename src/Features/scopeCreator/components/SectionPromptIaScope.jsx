import { useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Alert, Box, Chip, Typography } from "@mui/material";

import FieldPromptIaContext from "Features/promptIa/components/FieldPromptIaContext";
import ListPromptIaFiles from "Features/promptIa/components/ListPromptIaFiles";
import SectionPromptIaZipDownload from "Features/promptIa/components/SectionPromptIaZipDownload";
import DropZonePromptIaProject from "Features/promptIaProject/components/DropZonePromptIaProject";

import db from "App/db/db";

import usePromptIaProjectInput from "Features/promptIaProject/hooks/usePromptIaProjectInput";
import usePromptIaProjectOutput from "Features/promptIaProject/hooks/usePromptIaProjectOutput";

import buildPromptIaScopeZip from "Features/promptIaProject/services/buildPromptIaScopeZip";
import getPromptIaSummaryChips from "Features/promptIaProject/utils/getPromptIaSummaryChips";
import normalizePromptIaScopeOutput from "Features/promptIaProject/utils/normalizePromptIaScopeOutput";

const sectionCardSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "background.paper",
  p: 1.5,
};

/*
 * « Prompt IA » card of the recap (configuration kind PROMPT_IA), in three
 * blocks: the description + attachments, the zip handed to the AI chat, the
 * zip given back (dropped, read and summarized). The attachments and the
 * read output live here — mounted with the recap, released when it closes.
 * `onOutputChange(output | null)` hands the parent the parsed output (null
 * while reading or on error): it drives the create button.
 */
export default function SectionPromptIaScope({
  projectId,
  scopeName,
  disabled = false,
  onOutputChange,
}) {
  // strings

  const titleS = "Prompt IA";
  const contextS = "1 · Contexte";
  const introS =
    "Décrivez le Krto à créer et joignez vos documents : plans PDF, images, notes…";
  const placeholderS =
    "Ex. : repérer les murs et poteaux du RDC et du R+1, une liste par niveau, avec les surfaces de toiture terrasse.";
  const hintS = "Glissez-déposez plans PDF, images, notes…";
  const zipS = "2 · Zip pour le chat IA";
  const downloadS = "Télécharger le zip";
  const followUpS = "Déposez ensuite le zip renvoyé ci-dessous.";
  const missingDescriptionS =
    "Décrivez le Krto ci-dessus pour préparer le zip.";
  const resultS = "3 · Résultat";
  const dropS = "Glisser & déposer le zip renvoyé par le chat IA";
  const dropSubS =
    "projet.json + PDFs des fonds de plan (+ image satellite, documents)";
  const referenceLabelByType = {
    SATELLITE: "Référence : image satellite",
    BASE_MAP: "Référence : fond de plan",
  };

  // data

  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : null),
    [projectId]
  );

  const input = usePromptIaProjectInput({
    project,
    buildZip: ({ project: p, description, entries }) =>
      buildPromptIaScopeZip({ project: p, scopeName, description, entries }),
  });
  const output = usePromptIaProjectOutput({});

  // the parent only keeps the parsed output; the callback may change every
  // render, the output rarely.
  const onOutputChangeRef = useRef(onOutputChange);
  onOutputChangeRef.current = onOutputChange;
  useEffect(() => {
    onOutputChangeRef.current?.(output.output);
  }, [output.output]);

  // helpers

  const items = input.entries.map((entry) => ({
    key: entry.path,
    label: entry.path,
    sizeBytes: entry.file.size,
  }));
  const missingDescription = !input.description.trim();

  const read = output.output;
  const summaryChips = getPromptIaSummaryChips(read?.summary, {
    withScopes: false,
  });
  const site = read?.data?.site;
  const siteS = [site?.address, referenceLabelByType[site?.reference?.type]]
    .filter(Boolean)
    .join(" — ");
  const warnings = read
    ? [
        ...normalizePromptIaScopeOutput(read.data, {
          scopeId: "preview",
          scopeName: scopeName || "Krto",
        }).warnings,
        ...(read.data.warnings ?? []),
      ]
    : [];

  // handlers

  function handleDrop(dataTransfer) {
    output.loadZip(Array.from(dataTransfer.files ?? [])[0]);
  }

  function handleFiles(files) {
    output.loadZip(files[0]);
  }

  // render

  return (
    <Box sx={sectionCardSx}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
        {titleS}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* 1 — description + attachments */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {contextS}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {introS}
          </Typography>
          <FieldPromptIaContext
            value={input.description}
            onChange={input.setDescription}
            placeholder={placeholderS}
            maxLength={input.maxDescriptionLength}
            onFiles={input.addFiles}
            onDrop={input.addFromDrop}
            hint={hintS}
            loading={input.reading}
            disabled={disabled}
          >
            <ListPromptIaFiles
              items={items}
              onRemove={input.remove}
              disabled={disabled}
            />
          </FieldPromptIaContext>
          {Boolean(input.error) && (
            <Alert severity="error">{input.error}</Alert>
          )}
        </Box>

        {/* 2 — zip for the AI chat */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {zipS}
          </Typography>
          <SectionPromptIaZipDownload
            onDownload={input.download}
            disabled={disabled || !input.canDownload}
            building={input.building}
            built={input.downloaded}
            label={downloadS}
            followUp={followUpS}
          >
            {missingDescription && (
              <Alert severity="info">{missingDescriptionS}</Alert>
            )}
            {input.downloaded?.unreadablePdfs?.length > 0 && (
              <Alert severity="warning">
                {`PDF illisible(s), joint(s) tel(s) quel(s) : ${input.downloaded.unreadablePdfs.join(", ")}`}
              </Alert>
            )}
          </SectionPromptIaZipDownload>
        </Box>

        {/* 3 — the zip given back */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {resultS}
          </Typography>
          <DropZonePromptIaProject
            label={output.fileName && read ? output.fileName : dropS}
            subLabel={dropSubS}
            onDrop={handleDrop}
            onFiles={handleFiles}
            accept=".zip,application/zip"
            loading={output.reading}
            disabled={disabled}
          />
          {Boolean(output.error) && (
            <Alert severity="error">{output.error}</Alert>
          )}
          {read && (
            <>
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
              {Boolean(read.data.note) && (
                <Alert severity="info">{read.data.note}</Alert>
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
        </Box>
      </Box>
    </Box>
  );
}
