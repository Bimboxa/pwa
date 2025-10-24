import { useState } from "react";

import useCreateAnnotationTemplate from "../hooks/useCreateAnnotationTemplate";

import { Box, Typography } from "@mui/material";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FormAnnotationTemplateVariantBlock from "./FormAnnotationTemplateVariantBlock";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

import theme from "Styles/theme";

export default function SectionCreateAnnotationTemplateVariantBlock({
  onCreated,
  onCancel,
}) {
  // strings

  const titleS = "Nouveau modèle";
  const createS = "Créer";
  const cancelS = "Annuler";

  // data

  const createAnnotationTemplate = useCreateAnnotationTemplate();

  // state

  const [tempAnnotationTemplate, setTempAnnotationTemplate] = useState({
    type: "MARKER",
    fillColor: theme.palette.secondary.main,
    iconKey: "circle",
    label: "",
    isFromAnnotation: true,
  });

  // handlers

  async function handleCreate() {
    await createAnnotationTemplate(tempAnnotationTemplate);
    if (onCreated) onCreated();
  }

  return (
    <Box sx={{ p: 1 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          bgcolor: "white",
          p: 1,
          borderRadius: 1,
        }}
      >
        <FormAnnotationTemplateVariantBlock
          annotationTemplate={tempAnnotationTemplate}
          onChange={setTempAnnotationTemplate}
        />
        <BoxAlignToRight>
          <ButtonGeneric label={cancelS} onClick={onCancel} />
          <ButtonGeneric
            label={createS}
            onClick={handleCreate}
            disabled={!tempAnnotationTemplate.label}
          />
        </BoxAlignToRight>
      </Box>
    </Box>
  );
}
