import { Alert, Box, Typography } from "@mui/material";

import FieldPromptIaContext from "Features/promptIa/components/FieldPromptIaContext";
import ListPromptIaFiles from "Features/promptIa/components/ListPromptIaFiles";

export default function StepPromptIaProjectContext({ input }) {
  // strings

  const introS =
    "Décrivez les scopes à créer et joignez vos documents : plans PDF, images, notes…";
  const placeholderS =
    "Ex. : un scope « Gros œuvre » avec les murs et poteaux du RDC et du R+1, un scope « Étanchéité » avec les surfaces de toiture terrasse.";
  const hintS = "Glissez-déposez des fichiers, dossiers ou zips";

  // helpers

  const items = input.entries.map((entry) => ({
    key: entry.path,
    label: entry.path,
    sizeBytes: entry.file.size,
  }));

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
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
      >
        <ListPromptIaFiles items={items} onRemove={input.remove} />
      </FieldPromptIaContext>
      {Boolean(input.error) && <Alert severity="error">{input.error}</Alert>}
    </Box>
  );
}
