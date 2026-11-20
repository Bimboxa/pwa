import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { Box, FormControlLabel, Switch, Typography } from "@mui/material";

import db from "App/db/db";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import requestSubtractOnContactSync from "../services/requestSubtractOnContactSync";

// « Soustraire au contact »: the annotation is automatically subtracted from
// every annotation it touches in 3D (created, pasted or moved onto it) — see
// syncSubtractOnContactService. The hydrated flag is the effective one
// (annotation || template): when the template carries the option, the switch
// is shown on and locked.
export default function FieldAnnotationSubtractOnContact({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Soustraire au contact";
  const fromTemplateS = "Défini par le modèle";

  // helpers

  const fromTemplate =
    annotation?.annotationTemplateProps?.subtractOnContact === true;
  const checked = fromTemplate || Boolean(annotation?.subtractOnContact);

  // handlers

  async function handleChange(e, value) {
    if (!annotation?.id || fromTemplate) return;
    await db.annotations.update(annotation.id, { subtractOnContact: value });
    dispatch(triggerAnnotationsUpdate());
    if (value) requestSubtractOnContactSync([annotation.id]);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <FormControlLabel
          sx={{ pl: 1 }}
          control={
            <Switch
              size="small"
              checked={checked}
              disabled={fromTemplate}
              onChange={handleChange}
            />
          }
          label={<Typography variant="body2">{labelS}</Typography>}
        />
        {fromTemplate && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            {fromTemplateS}
          </Typography>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
