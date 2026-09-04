// Horizontal stub ("déport horizontal") of the label leader line:
// target → elbow → horizontal segment → chip edge.
//
// - labelStubLength: screen px (the chip is screen-constant), 0 = straight
//   single-segment leader.
// - labelStubMode: "FIXED" keeps the screen length when the chip is dragged
//   (the elbow follows the chip); "VARIABLE" pins the elbow in map space
//   (stored in labelDelta.elbow / elbowPoint) so the stub length follows.
//
// Resolution: annotation own value ?? template value ?? app default. The
// template value is a READ-TIME default (not seeded at creation) so editing
// the template propagates to every annotation without its own value; the
// padlock (overrideFields) forces the template value through the generic
// override loop of getAnnotationPropsFromAnnotationTemplateProps.

export const DEFAULT_LABEL_STUB_LENGTH = 32;
export const DEFAULT_LABEL_STUB_MODE = "FIXED";
export const LABEL_STUB_MODES = ["FIXED", "VARIABLE"];
export const LABEL_STUB_FIELDS = ["labelStubLength", "labelStubMode"];

function parseLength(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, n);
}

function parseMode(raw) {
  return LABEL_STUB_MODES.includes(raw) ? raw : undefined;
}

export function hasOwnLabelStubValue(annotation) {
  return (
    parseLength(annotation?.labelStubLength) !== undefined ||
    parseMode(annotation?.labelStubMode) !== undefined
  );
}

export default function getAnnotationLabelStubConfig(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  const length =
    parseLength(annotation?.labelStubLength) ??
    parseLength(templateProps?.labelStubLength) ??
    DEFAULT_LABEL_STUB_LENGTH;
  const mode =
    parseMode(annotation?.labelStubMode) ??
    parseMode(templateProps?.labelStubMode) ??
    DEFAULT_LABEL_STUB_MODE;
  return { length, mode };
}
