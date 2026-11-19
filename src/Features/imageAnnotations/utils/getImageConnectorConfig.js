// Link line ("connecteur") of a photo (IMAGE annotation): colour and end
// marker drawn on the anchor.
//
// - imageConnectorColor: colour of the line and of its end marker.
// - imageConnectorEnd: "NUMBER" (numbered badge), "ARROW" or "POINT".
//
// Resolution: annotation own value ?? template value ?? app default. The
// template value is a READ-TIME default (not seeded at creation, hence not in
// drawingShapeConfig configurableProps) so editing the template propagates to
// every photo without its own value — same model as
// getAnnotationLabelStubConfig.

export const DEFAULT_IMAGE_CONNECTOR_COLOR = "#333333";
export const DEFAULT_IMAGE_CONNECTOR_END = "NUMBER";
export const IMAGE_CONNECTOR_ENDS = ["NUMBER", "ARROW", "POINT"];
export const IMAGE_CONNECTOR_FIELDS = [
  "imageConnectorColor",
  "imageConnectorEnd",
];
// Manual display number: short free text, replaces the automatic rank.
export const IMAGE_NUMBER_MAX_LENGTH = 4;

function parseColor(raw) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function parseEnd(raw) {
  return IMAGE_CONNECTOR_ENDS.includes(raw) ? raw : undefined;
}

export function hasOwnImageConnectorValue(annotation) {
  return (
    parseColor(annotation?.imageConnectorColor) !== undefined ||
    parseEnd(annotation?.imageConnectorEnd) !== undefined
  );
}

// Manual number of a photo, or null when the automatic rank applies.
export function getImageManualNumber(annotation) {
  const raw = annotation?.imageNumber;
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().slice(0, IMAGE_NUMBER_MAX_LENGTH);
  return text || null;
}

export default function getImageConnectorConfig(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  const color =
    parseColor(annotation?.imageConnectorColor) ??
    parseColor(templateProps?.imageConnectorColor) ??
    DEFAULT_IMAGE_CONNECTOR_COLOR;
  const end =
    parseEnd(annotation?.imageConnectorEnd) ??
    parseEnd(templateProps?.imageConnectorEnd) ??
    DEFAULT_IMAGE_CONNECTOR_END;
  return { color, end };
}
