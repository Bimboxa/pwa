// Link line ("connecteur") of the photos (IMAGE annotations): colour and end
// marker drawn on the anchor. A GLOBAL display setting of the photos (same
// for every photo, per device): stored in popperImagesSlice (`connector`),
// edited in DialogImagesDisplayOptions ("…" of the bottom bar controls).
//
// - color: colour of the line and of its end marker.
// - end: "NUMBER" (numbered badge), "ARROW" or "POINT". With "ARROW" /
//   "POINT" the number, when displayed ("Numéro" toggle), moves to the
//   top-left corner of the photo.
// - line: "SOLID", "DASHED" or "NONE" — the line itself, in the 3 display
//   modes (photo ↔ anchor in situ, tile ↔ anchor off in situ).
// - size: size of the end marker in PAGE POINTS of the base map's print zone
//   (fixed relative to the plan, like COTE / FREE_TEXT ink). It is the font
//   size of the number; the badge, arrow head and dot scale with it (their
//   geometry is designed for the default size).

export const DEFAULT_IMAGE_CONNECTOR_COLOR = "#333333";
export const DEFAULT_IMAGE_CONNECTOR_END = "NUMBER";
export const DEFAULT_IMAGE_CONNECTOR_SIZE = 11;
export const IMAGE_CONNECTOR_SIZE_MIN = 2;
export const IMAGE_CONNECTOR_SIZE_MAX = 200;
export const IMAGE_CONNECTOR_ENDS = ["NUMBER", "ARROW", "POINT"];
export const DEFAULT_IMAGE_CONNECTOR_LINE = "SOLID";
export const IMAGE_CONNECTOR_LINES = ["SOLID", "DASHED", "NONE"];
// Dash pattern of a "DASHED" line, in screen px.
export const IMAGE_CONNECTOR_DASH = "5 4";
// Manual display number: short free text, replaces the automatic rank.
export const IMAGE_NUMBER_MAX_LENGTH = 4;

function parseColor(raw) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function parseEnd(raw) {
  return IMAGE_CONNECTOR_ENDS.includes(raw) ? raw : undefined;
}

function parseLine(raw) {
  return IMAGE_CONNECTOR_LINES.includes(raw) ? raw : undefined;
}

// Valid size in pt (clamped), or undefined for an empty / invalid input.
export function parseImageConnectorSize(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(
    IMAGE_CONNECTOR_SIZE_MAX,
    Math.max(IMAGE_CONNECTOR_SIZE_MIN, n)
  );
}

// Manual number of a photo, or null when the automatic rank applies.
export function getImageManualNumber(annotation) {
  const raw = annotation?.imageNumber;
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().slice(0, IMAGE_NUMBER_MAX_LENGTH);
  return text || null;
}

// Sanitized { color, end, line, size } from a stored / partial config.
export default function getImageConnectorConfig(raw) {
  return {
    color: parseColor(raw?.color) ?? DEFAULT_IMAGE_CONNECTOR_COLOR,
    end: parseEnd(raw?.end) ?? DEFAULT_IMAGE_CONNECTOR_END,
    line: parseLine(raw?.line) ?? DEFAULT_IMAGE_CONNECTOR_LINE,
    size: parseImageConnectorSize(raw?.size) ?? DEFAULT_IMAGE_CONNECTOR_SIZE,
  };
}
