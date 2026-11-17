// "Ligne de déport" (offset line) of a POLYLINE / POLYGON / STRIP annotation:
// a thin line drawn parallel to the annotation's main line, optionally
// carrying the annotation label along each segment.
//
// Stored as ONE object field, `offsetLine`, on the annotation and on the
// annotation template:
// - enabled: boolean — draw the offset line.
// - offset: signed distance to the main line, in PAGE POINTS of the base
//   map's print zone (see getCotePageScale). The sign is the side: positive =
//   right of the drawing direction.
// - fontSize: label text size, in page points.
// - showLabel: boolean — draw the label along the line, one per segment.
//
// Resolution, per key: annotation own value ?? template value ?? app default
// — the same READ-TIME model as the LABEL size (getAnnotationLabelSizeConfig):
// the template value is not seeded at creation, so editing the template
// propagates to every annotation without its own value. The padlock
// ("offsetLine" in overrideFields) swaps the whole object for the template's
// through the generic loop of getAnnotationPropsFromAnnotationTemplateProps.

export const OFFSET_LINE_FIELDS = ["offsetLine"];

export const OFFSET_LINE_ANNOTATION_TYPES = ["POLYLINE", "POLYGON", "STRIP"];

export const DEFAULT_OFFSET_LINE_ENABLED = false;
export const DEFAULT_OFFSET_LINE_OFFSET_PT = 12;
export const DEFAULT_OFFSET_LINE_FONT_SIZE_PT = 10;
export const DEFAULT_OFFSET_LINE_SHOW_LABEL = true;

function parseBoolean(raw) {
  return typeof raw === "boolean" ? raw : undefined;
}

function parseOffset(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseFontSize(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseOffsetLine(raw) {
  return {
    enabled: parseBoolean(raw?.enabled),
    offset: parseOffset(raw?.offset),
    fontSize: parseFontSize(raw?.fontSize),
    showLabel: parseBoolean(raw?.showLabel),
  };
}

export function hasOwnOffsetLineValue(annotation) {
  const own = parseOffsetLine(annotation?.offsetLine);
  return Object.values(own).some((value) => value !== undefined);
}

export function isOffsetLineLocked(overrideFields) {
  return (
    Array.isArray(overrideFields) &&
    OFFSET_LINE_FIELDS.every((f) => overrideFields.includes(f))
  );
}

export default function getAnnotationOffsetLineConfig(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  const own = parseOffsetLine(annotation?.offsetLine);
  const fromTemplate = parseOffsetLine(templateProps?.offsetLine);
  return {
    enabled: own.enabled ?? fromTemplate.enabled ?? DEFAULT_OFFSET_LINE_ENABLED,
    offset: own.offset ?? fromTemplate.offset ?? DEFAULT_OFFSET_LINE_OFFSET_PT,
    fontSize:
      own.fontSize ?? fromTemplate.fontSize ?? DEFAULT_OFFSET_LINE_FONT_SIZE_PT,
    showLabel:
      own.showLabel ?? fromTemplate.showLabel ?? DEFAULT_OFFSET_LINE_SHOW_LABEL,
  };
}
