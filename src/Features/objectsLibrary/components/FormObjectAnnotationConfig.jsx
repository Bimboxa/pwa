import { Box, Typography } from "@mui/material";
import { Settings } from "@mui/icons-material";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldCheck from "Features/form/components/FieldCheck";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import FieldAnnotationTemplateFill from "Features/annotations/components/FieldAnnotationTemplateFill";
import FieldAnnotationTemplateStroke from "Features/annotations/components/FieldAnnotationTemplateStroke";

// "Configurer l'annotation" — renders ONLY the parameters the object declares in
// its `editableParams`. The 2D shape is fixed per object (defined in the JSON),
// so there is no shape selector here. Driven by a plain draft + onChange.
const noop = () => {};

export default function FormObjectAnnotationConfig({
  object,
  draft,
  onChange,
}) {
  // helpers

  const editable = Array.isArray(object?.editableParams)
    ? object.editableParams
    : [];
  const has = (key) => editable.includes(key);
  const hasFill = has("fillColor") || has("fillType") || has("fillOpacity");
  const hasStroke =
    has("strokeColor") ||
    has("strokeWidth") ||
    has("strokeOpacity") ||
    has("strokeType");

  function patch(partial) {
    onChange({ ...draft, ...partial });
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Settings color="primary" fontSize="small" />
        <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
          Configurer l&apos;annotation
        </Typography>
      </Box>

      {has("label") && (
        <FieldTextV2
          label="Libellé"
          value={draft.label ?? ""}
          onChange={(v) => patch({ label: v })}
          options={{
            showAsField: true,
            showLabel: false,
            placeholder: `Ex : ${object.label}`,
          }}
        />
      )}

      {has("height") && (
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Épaisseur
            </Typography>
            <FieldAnnotationHeight
              annotation={draft}
              onChange={(a) => onChange(a)}
              label=""
              field="height"
              unit="m"
            />
          </Box>
        </WhiteSectionGeneric>
      )}

      {hasFill && (
        <FieldAnnotationTemplateFill
          value={draft}
          onChange={(v) => onChange(v)}
          overrideFields={[]}
          onOverrideFieldsChange={noop}
        />
      )}

      {hasStroke && (
        <FieldAnnotationTemplateStroke
          value={draft}
          onChange={(v) => onChange(v)}
          overrideFields={[]}
          onOverrideFieldsChange={noop}
        />
      )}

      {has("hideSlope") && (
        <FieldCheck
          label="Masquer la pente"
          value={Boolean(draft.hideSlope)}
          onChange={(v) => patch({ hideSlope: v })}
          options={{ type: "switch", showAsSection: true }}
        />
      )}
    </Box>
  );
}
