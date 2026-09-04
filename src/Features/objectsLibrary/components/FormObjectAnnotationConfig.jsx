import { Box, Typography } from "@mui/material";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldCheck from "Features/form/components/FieldCheck";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import FieldAnnotationTemplateFill from "Features/annotations/components/FieldAnnotationTemplateFill";
import FieldAnnotationTemplateStroke from "Features/annotations/components/FieldAnnotationTemplateStroke";
import FieldAnnotationTemplateStrokeWidth from "Features/annotations/components/FieldAnnotationTemplateStrokeWidth";
import FieldAnnotationTemplateRender3d from "Features/annotations/components/FieldAnnotationTemplateRender3d";

import { MATERIAL3D_NONE_KEY } from "Features/photorealRender/utils/material3dPresets";

import isObject3DEntry from "../utils/isObject3DEntry";

// "Configurer l'annotation" — renders ONLY the parameters the object declares in
// its `editableParams`. The 2D shape is fixed per object (defined in the JSON),
// so there is no shape selector here. Driven by a plain draft + onChange.

export default function FormObjectAnnotationConfig({
  object,
  draft,
  onChange,
}) {
  // helpers

  const editable = Array.isArray(object?.editableParams)
    ? object.editableParams
    : [];
  // 3D objects have no 2D style params: the only thing to configure is the
  // annotationTemplate label (defaulted to the object name by the dialog).
  const has = (key) =>
    editable.includes(key) || (key === "label" && isObject3DEntry(object));
  const hasFill = has("fillColor") || has("fillType") || has("fillOpacity");
  const hasStroke =
    has("strokeColor") || has("strokeOpacity") || has("strokeType");
  const hasStrokeWidth = has("strokeWidth");
  const hasMaterial3d = has("material3d");
  const hasRender3d = has("color3D") || has("opacity3D") || hasMaterial3d;

  // `height` is the slab thickness on a surface, the wall height on a line —
  // same wording as the annotation template form.
  const heightLabel =
    object?.drawingShape === "POLYGON" ? "Épaisseur" : "Hauteur";

  // 2D colour / opacity shown as the inherited placeholder of the "Rendu 3D"
  // section (fill-driven for a surface, stroke-driven for a line).
  const render3dFallbackColor = hasFill
    ? draft.fillColor || draft.strokeColor || "#cccccc"
    : draft.strokeColor || draft.fillColor || "#cccccc";
  const render3dFallbackOpacity = hasFill
    ? draft.fillOpacity
    : draft.strokeOpacity;

  function patch(partial) {
    onChange({ ...draft, ...partial });
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 0.5 }}>
        Configurer l&apos;annotation
      </Typography>

      {has("label") && (
        <FieldTextV2
          label="Libellé"
          value={draft.label ?? ""}
          onChange={(v) => patch({ label: v })}
          options={{
            showAsField: true,
            showLabel: false,
            placeholder: `Ex : ${object.label ?? ""}`,
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
              {heightLabel}
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
        />
      )}

      {hasStroke && (
        <FieldAnnotationTemplateStroke
          value={draft}
          onChange={(v) => onChange(v)}
        />
      )}

      {hasStrokeWidth && (
        <FieldAnnotationTemplateStrokeWidth
          value={draft}
          onChange={(v) => onChange(v)}
        />
      )}

      {hasRender3d && (
        <FieldAnnotationTemplateRender3d
          color3D={draft.color3D}
          opacity3D={draft.opacity3D}
          material3d={draft.material3d}
          fallbackColor={render3dFallbackColor}
          fallbackOpacity={render3dFallbackOpacity}
          hasMaterial3d={hasMaterial3d}
          onColor3DChange={(color3D) => patch({ color3D })}
          onOpacity3DChange={(opacity3D) => patch({ opacity3D })}
          onMaterial3dChange={(key) =>
            patch({ material3d: key === MATERIAL3D_NONE_KEY ? null : key })
          }
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
