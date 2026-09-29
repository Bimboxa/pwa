import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { Box, Typography } from "@mui/material";

import db from "App/db/db";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldAnnotationLabelStub from "./FieldAnnotationLabelStub";
import FieldAnnotationLabelTextSize from "./FieldAnnotationLabelTextSize";

// "Etiquette" tab of the annotation properties panel: visibility, content
// (template label / annotation label / free description) and text size of the
// annotation label rendered in the 2D and 3D scenes.
export default function SectionAnnotationLabelContent({ annotation }) {
  const dispatch = useDispatch();

  // helpers — defaults mirror getAnnotationLabelTextLines

  const showLabel = Boolean(annotation?.showLabel);
  const showTemplateLabel = annotation?.labelShowTemplateLabel === true;
  const showAnnotationLabel = annotation?.labelShowAnnotationLabel !== false;
  const showDescription = annotation?.labelShowDescription !== false;
  const description = annotation?.labelDescription ?? "";
  const shadow = annotation?.labelShadow === true;

  const templateLabel =
    annotation?.templateLabel ?? annotation?.annotationTemplate?.label;
  const overrideFields = annotation?.annotationTemplate?.overrideFields;

  // handlers

  async function updateAnnotationFields(updates) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, updates);
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <Box
      sx={{ p: 1, width: 1, display: "flex", flexDirection: "column", gap: 1 }}
    >
      <FieldCheck
        value={showLabel}
        onChange={(checked) => updateAnnotationFields({ showLabel: checked })}
        label="Afficher l'étiquette"
        options={{ type: "switch", showAsField: true }}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          ...(!showLabel && { opacity: 0.5, pointerEvents: "none" }),
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
          Contenu
        </Typography>

        <FieldCheck
          value={showTemplateLabel}
          onChange={(checked) =>
            updateAnnotationFields({ labelShowTemplateLabel: checked })
          }
          label={
            templateLabel
              ? `Libellé du modèle · ${templateLabel}`
              : "Libellé du modèle"
          }
          options={{ type: "switch", showAsField: true }}
        />

        <FieldCheck
          value={showAnnotationLabel}
          onChange={(checked) =>
            updateAnnotationFields({ labelShowAnnotationLabel: checked })
          }
          label="Libellé de l'annotation"
          options={{ type: "switch", showAsField: true }}
        />

        <WhiteSectionGeneric>
          <Box
            sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                Description
              </Typography>
              <FieldCheck
                value={showDescription}
                onChange={(checked) =>
                  updateAnnotationFields({ labelShowDescription: checked })
                }
                label=""
                options={{ type: "switch", showAsInline: true }}
              />
            </Box>
            <FieldTextV2
              value={description}
              onChange={(value) =>
                updateAnnotationFields({ labelDescription: value })
              }
              label="Description"
              options={{
                showLabel: false,
                fullWidth: true,
                multiline: true,
                changeOnBlur: true,
                placeholder: "Texte libre…",
              }}
            />
          </Box>
        </WhiteSectionGeneric>

        <FieldAnnotationLabelTextSize
          annotation={annotation}
          overrideFields={overrideFields}
        />

        <FieldAnnotationLabelStub
          annotation={annotation}
          overrideFields={overrideFields}
        />

        <FieldCheck
          value={shadow}
          onChange={(checked) =>
            updateAnnotationFields({ labelShadow: checked })
          }
          label="Ombre"
          options={{ type: "switch", showAsField: true }}
        />
      </Box>
    </Box>
  );
}
