// Shared display model of an annotation's label ("Etiquette" tab), used by
// both the 2D chip (NodeLabelStatic) and the 3D card sprite
// (createAnnotationLabelSprite) so the two views always show the same content.

// Legacy S / M / L presets of `annotation.labelFontSize` ("M" = historical
// DEFAULT_FONT_SIZE). The field now stores a free number; rows saved with a
// preset keep rendering at these sizes.
export const ANNOTATION_LABEL_FONT_SIZES_PX = { S: 11, M: 14, L: 18 };

export const DEFAULT_ANNOTATION_LABEL_FONT_SIZE =
  ANNOTATION_LABEL_FONT_SIZES_PX.M;

export const LABEL_FONT_SIZE_FIELDS = ["labelFontSize"];

// A number, or a legacy "S" | "M" | "L" preset.
function parseLabelFontSize(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  return ANNOTATION_LABEL_FONT_SIZES_PX[raw];
}

export function hasOwnLabelFontSizeValue(annotation) {
  return parseLabelFontSize(annotation?.labelFontSize) !== undefined;
}

/**
 * Font size of an annotation's label chip (`labelFontSize`). Unit: page points
 * of the print zone, the chip being always fixed relative to it (see
 * getAnnotationLabelFixedSizeConfig).
 *
 * Resolution: annotation own value ?? template value ?? app default — the
 * same READ-TIME model as the leader stub (getAnnotationLabelStubConfig); the
 * padlock (overrideFields) forces the template value through the generic
 * override loop of getAnnotationPropsFromAnnotationTemplateProps.
 *
 * The 3D card derives its on-screen size from the SAME value (see
 * createAnnotationLabelSprite / sizeSpriteInCssPx), so both views match.
 */
export function getAnnotationLabelFontSize(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  return (
    parseLabelFontSize(annotation?.labelFontSize) ??
    parseLabelFontSize(templateProps?.labelFontSize) ??
    DEFAULT_ANNOTATION_LABEL_FONT_SIZE
  );
}

/**
 * The annotation's OWN label — the `label` field of the annotation row.
 * Deliberately NOT the entity label nor the template fallback: `annotation.label`
 * is overwritten upstream by both (useAnnotationsV2 entity enrichment,
 * getAnnotationPropsFromAnnotationTemplateProps), which stamp the row value as
 * `annotationLabel`. The plain `label` fallback covers raw db rows.
 */
export function getAnnotationOwnLabel(annotation) {
  return annotation?.annotationLabel ?? annotation?.label;
}

/**
 * Content lines of an annotation label, from the "Etiquette" options stored
 * on the annotation row. Defaults keep the historical rendering (annotation
 * label only) when none of the options was ever set:
 * - labelShowTemplateLabel: default false (=== true to enable)
 * - labelShowAnnotationLabel: default true (!== false)
 * - labelShowDescription: default true, only matters when labelDescription is set
 *
 * @returns {Array<{kind: "TEMPLATE"|"LABEL"|"DESCRIPTION", text: string}>}
 */
export function getAnnotationLabelTextLines(annotation) {
  if (!annotation) return [];

  const lines = [];

  const templateLabel =
    annotation.annotationTemplateProps?.label ??
    annotation.templateLabel ??
    annotation.annotationTemplate?.label;

  if (annotation.labelShowTemplateLabel === true && templateLabel) {
    lines.push({ kind: "TEMPLATE", text: templateLabel });
  }

  if (annotation.labelShowAnnotationLabel !== false) {
    const label = getAnnotationOwnLabel(annotation);
    // Skip when it would just repeat the TEMPLATE line above.
    const duplicatesTemplate =
      annotation.labelShowTemplateLabel === true && label === templateLabel;
    if (label && !duplicatesTemplate) {
      lines.push({ kind: "LABEL", text: label });
    }
  }

  if (
    annotation.labelShowDescription !== false &&
    annotation.labelDescription
  ) {
    lines.push({ kind: "DESCRIPTION", text: annotation.labelDescription });
  }

  return lines;
}
