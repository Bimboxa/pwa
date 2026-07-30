// Shared display model of an annotation's label ("Etiquette" tab), used by
// both the 2D chip (NodeLabelStatic) and the 3D card sprite
// (createAnnotationLabelSprite) so the two views always show the same content.

// 2D chip font size in screen px per preset ("M" = historical DEFAULT_FONT_SIZE).
export const ANNOTATION_LABEL_FONT_SIZES_PX = { S: 11, M: 14, L: 18 };

// The 3D card derives its on-screen size from the SAME px sizes (see
// createAnnotationLabelSprite / sizeSpriteInCssPx), so both views match.

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
