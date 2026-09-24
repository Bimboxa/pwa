import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import FieldTextV2 from "Features/form/components/FieldTextV2";

// Free-text description of the template ("how to recognize this work on the
// plan"). It is not inherited by annotations: it is meant as context for the
// AI assistant when it detects annotations, and as a default hint for AI Tasks.
export default function FieldAnnotationTemplateDescription({
  description,
  onDescriptionChange,
}) {
  // strings

  const titleS = "Description";
  const hintS = "Utilisée comme contexte par l'assistant IA pour le repérage.";
  const placeholderS = "Comment reconnaître cet ouvrage sur le plan…";

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <WhiteSectionTitle>{titleS}</WhiteSectionTitle>
        <Typography variant="caption" color="text.secondary">
          {hintS}
        </Typography>
        <FieldTextV2
          value={description ?? ""}
          onChange={onDescriptionChange}
          options={{
            showLabel: false,
            fullWidth: true,
            multiline: true,
            changeOnBlur: true,
            placeholder: placeholderS,
          }}
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
