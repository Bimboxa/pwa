import { useLiveQuery } from "dexie-react-hooks";

import { Alert, Box, Typography } from "@mui/material";

import FieldPromptIaContext from "Features/promptIa/components/FieldPromptIaContext";
import ListPromptIaFiles from "Features/promptIa/components/ListPromptIaFiles";
import SectionPromptIaZipDownload from "Features/promptIa/components/SectionPromptIaZipDownload";

import db from "App/db/db";

import usePromptIaProjectInput from "Features/promptIaProject/hooks/usePromptIaProjectInput";

import buildPromptIaScopeZip from "Features/promptIaProject/services/buildPromptIaScopeZip";

const sectionCardSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "background.paper",
  p: 1.5,
};

/*
 * Right-column card of the Prompt IA recap (configuration kind PROMPT_IA),
 * in place of the configuration illustration: the description +
 * attachments, then the zip handed to the AI chat. The zip given back is
 * dropped in SectionPromptIaResult (left column). The attachments live here
 * — mounted with the recap, released when it closes.
 */
export default function SectionPromptIaRequest({
  projectId,
  scopeName,
  disabled = false,
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
  const followUpS =
    "Déposez ensuite le zip renvoyé dans la colonne de gauche (étape 3).";

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

  // helpers

  const items = input.entries.map((entry) => ({
    key: entry.path,
    label: entry.path,
    sizeBytes: entry.file.size,
  }));
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
            {input.downloaded?.unreadablePdfs?.length > 0 && (
              <Alert severity="warning">
                {`PDF illisible(s), joint(s) tel(s) quel(s) : ${input.downloaded.unreadablePdfs.join(", ")}`}
              </Alert>
            )}
          </SectionPromptIaZipDownload>
        </Box>
      </Box>
    </Box>
  );
}
