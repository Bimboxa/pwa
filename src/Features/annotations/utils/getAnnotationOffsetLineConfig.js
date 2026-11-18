import {
  DEFAULT_COTE_DECIMALS,
  DEFAULT_COTE_UNIT,
  UNIT_FACTORS_FROM_METERS,
} from "Features/annotations/constants/coteDisplayDefaults";

// "Ligne de déport" (offset line) of a POLYLINE / POLYGON / STRIP annotation:
// a thin line drawn parallel to the annotation's main line, optionally
// carrying the annotation label along each segment.
//
// Stored as ONE object field, `offsetLine`, on the annotation and on the
// annotation template:
// - enabled: boolean — draw the offset line.
// - offset: signed distance to the main line, in `offsetUnit`. The sign is
//   the side: positive = right of the drawing direction; for a STRIP,
//   positive = the side opposite the band (follows stripOrientation, see
//   NodeOffsetLineStatic).
// - offsetUnit: "PT" | "CM" — unit of `offset`. "PT" = page points of the
//   base map's print zone (see getCotePageScale): fixed on paper. "CM" =
//   real-world centimetres, through the base map scale (falls back to page
//   points when the base map has no scale, see getOffsetLinePxPerUnit).
// - strokeWidth: line thickness, in page points.
// - dashed: boolean — dashed line instead of a solid one.
// - fontSize: label text size, in page points.
// - labelSource: "TEMPLATE" | "ANNOTATION" | "NONE" — the label drawn along
//   the line, one per segment: the template's, the annotation's own, or
//   none. Replaces the first version's `showLabel` boolean (only its `false`
//   is still read, as "NONE").
// - showLength: boolean — add the segment length to that text, formatted
//   like a cote: lengthUnit ("CM" | "M"), lengthDecimals, showLengthUnit
//   (unit suffix).
// - hideMainLine: boolean — draw ONLY the offset line: the annotation's own
//   shape is hidden on the plan, and shown again while the annotation is
//   selected so it can be edited (see NodeAnnotationStatic).
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
export const OFFSET_LINE_OFFSET_UNIT_PT = "PT";
export const OFFSET_LINE_OFFSET_UNIT_CM = "CM";
const OFFSET_UNITS = [OFFSET_LINE_OFFSET_UNIT_PT, OFFSET_LINE_OFFSET_UNIT_CM];
export const DEFAULT_OFFSET_LINE_OFFSET_UNIT = OFFSET_LINE_OFFSET_UNIT_PT;
export const DEFAULT_OFFSET_LINE_STROKE_WIDTH_PT = 1;
export const DEFAULT_OFFSET_LINE_DASHED = false;
export const DEFAULT_OFFSET_LINE_FONT_SIZE_PT = 10;
export const OFFSET_LINE_LABEL_SOURCE_TEMPLATE = "TEMPLATE";
export const OFFSET_LINE_LABEL_SOURCE_ANNOTATION = "ANNOTATION";
export const OFFSET_LINE_LABEL_SOURCE_NONE = "NONE";
const LABEL_SOURCES = [
  OFFSET_LINE_LABEL_SOURCE_TEMPLATE,
  OFFSET_LINE_LABEL_SOURCE_ANNOTATION,
  OFFSET_LINE_LABEL_SOURCE_NONE,
];
export const DEFAULT_OFFSET_LINE_LABEL_SOURCE =
  OFFSET_LINE_LABEL_SOURCE_TEMPLATE;
export const DEFAULT_OFFSET_LINE_SHOW_LENGTH = false;
export const DEFAULT_OFFSET_LINE_LENGTH_UNIT = DEFAULT_COTE_UNIT;
export const DEFAULT_OFFSET_LINE_LENGTH_DECIMALS = DEFAULT_COTE_DECIMALS;
export const DEFAULT_OFFSET_LINE_SHOW_LENGTH_UNIT = true;
export const DEFAULT_OFFSET_LINE_HIDE_MAIN_LINE = false;

function parseBoolean(raw) {
  return typeof raw === "boolean" ? raw : undefined;
}

function parseOffset(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseOffsetUnit(raw) {
  return OFFSET_UNITS.includes(raw) ? raw : undefined;
}

function parsePositive(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseUnit(raw) {
  return typeof raw === "string" && raw in UNIT_FACTORS_FROM_METERS
    ? raw
    : undefined;
}

function parseDecimals(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function parseLabelSource(raw) {
  if (LABEL_SOURCES.includes(raw?.labelSource)) return raw.labelSource;
  // Legacy switch turned off.
  if (raw?.showLabel === false) return OFFSET_LINE_LABEL_SOURCE_NONE;
  return undefined;
}

function parseOffsetLine(raw) {
  return {
    enabled: parseBoolean(raw?.enabled),
    offset: parseOffset(raw?.offset),
    offsetUnit: parseOffsetUnit(raw?.offsetUnit),
    strokeWidth: parsePositive(raw?.strokeWidth),
    dashed: parseBoolean(raw?.dashed),
    fontSize: parsePositive(raw?.fontSize),
    labelSource: parseLabelSource(raw),
    showLength: parseBoolean(raw?.showLength),
    lengthUnit: parseUnit(raw?.lengthUnit),
    lengthDecimals: parseDecimals(raw?.lengthDecimals),
    showLengthUnit: parseBoolean(raw?.showLengthUnit),
    hideMainLine: parseBoolean(raw?.hideMainLine),
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

// Image px per unit of `offset`. "CM" needs the base map scale (m / px);
// without one the value is read as page points, like "PT".
export function getOffsetLinePxPerUnit({ offsetUnit, pageScale, meterByPx }) {
  if (
    offsetUnit === OFFSET_LINE_OFFSET_UNIT_CM &&
    Number.isFinite(meterByPx) &&
    meterByPx > 0
  ) {
    return 0.01 / meterByPx;
  }
  return pageScale;
}

export default function getAnnotationOffsetLineConfig(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  const own = parseOffsetLine(annotation?.offsetLine);
  const fromTemplate = parseOffsetLine(templateProps?.offsetLine);
  return {
    enabled: own.enabled ?? fromTemplate.enabled ?? DEFAULT_OFFSET_LINE_ENABLED,
    offset: own.offset ?? fromTemplate.offset ?? DEFAULT_OFFSET_LINE_OFFSET_PT,
    offsetUnit:
      own.offsetUnit ??
      fromTemplate.offsetUnit ??
      DEFAULT_OFFSET_LINE_OFFSET_UNIT,
    strokeWidth:
      own.strokeWidth ??
      fromTemplate.strokeWidth ??
      DEFAULT_OFFSET_LINE_STROKE_WIDTH_PT,
    dashed: own.dashed ?? fromTemplate.dashed ?? DEFAULT_OFFSET_LINE_DASHED,
    fontSize:
      own.fontSize ?? fromTemplate.fontSize ?? DEFAULT_OFFSET_LINE_FONT_SIZE_PT,
    labelSource:
      own.labelSource ??
      fromTemplate.labelSource ??
      DEFAULT_OFFSET_LINE_LABEL_SOURCE,
    showLength:
      own.showLength ??
      fromTemplate.showLength ??
      DEFAULT_OFFSET_LINE_SHOW_LENGTH,
    lengthUnit:
      own.lengthUnit ??
      fromTemplate.lengthUnit ??
      DEFAULT_OFFSET_LINE_LENGTH_UNIT,
    lengthDecimals:
      own.lengthDecimals ??
      fromTemplate.lengthDecimals ??
      DEFAULT_OFFSET_LINE_LENGTH_DECIMALS,
    showLengthUnit:
      own.showLengthUnit ??
      fromTemplate.showLengthUnit ??
      DEFAULT_OFFSET_LINE_SHOW_LENGTH_UNIT,
    hideMainLine:
      own.hideMainLine ??
      fromTemplate.hideMainLine ??
      DEFAULT_OFFSET_LINE_HIDE_MAIN_LINE,
  };
}
