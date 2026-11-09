import { useEffect, useRef } from "react";

import { Alert, Box, Chip, Typography } from "@mui/material";

import DropZonePromptIaProject from "Features/promptIaProject/components/DropZonePromptIaProject";

import usePromptIaProjectOutput from "Features/promptIaProject/hooks/usePromptIaProjectOutput";

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
 * Left-column card of the Prompt IA recap (configuration kind PROMPT_IA):
 * the zip given back by the AI chat — dropped, read and summarized. The
 * request side (description, attachments, zip for the chat) is
 * SectionPromptIaRequest, in the right column. The read output lives here —
 * mounted with the recap, released when it closes. `onOutputChange(output |
 * null)` hands the parent the parsed output (null while reading or on
 * error): it drives the create button.
 */
export default function SectionPromptIaResult({
  scopeName,
  disabled = false,
  onOutputChange,
}) {
  // strings

  const titleS = "3 · Zip renvoyé par l'IA";
  const dropS = "Glisser & déposer le zip renvoyé par le chat IA";
  const dropSubS =
    "projet.json + PDFs des fonds de plan (+ maillages GLB, image satellite, documents)";
  const referenceLabelByType = {
    SATELLITE: "Référence : image satellite",
    BASE_MAP: "Référence : fond de plan",
  };

  // data

  const output = usePromptIaProjectOutput({});

  // the parent only keeps the parsed output; the callback may change every
  // render, the output rarely.
  const onOutputChangeRef = useRef(onOutputChange);
  onOutputChangeRef.current = onOutputChange;
  useEffect(() => {
    onOutputChangeRef.current?.(output.output);
  }, [output.output]);

  // helpers

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

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
  );
}
