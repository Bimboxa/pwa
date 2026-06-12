// Deterministic extraction of real-world dimensions from the user prompt.
// Small on-device models echo numbers unreliably, so when the user wrote
// explicit dimensions ("5m x 5m", "2,5 m par 1m", "50cm de côté"), the parsed
// values take precedence over whatever the model generated.

const NUM = "(\\d+(?:[.,]\\d+)?)";
const UNIT = "(m|mètres?|cm)";

const PAIR_REGEX = new RegExp(
  `${NUM}\\s*${UNIT}?\\s*(?:x|×|\\*|par)\\s*${NUM}\\s*${UNIT}`,
  "i"
);
const SIDE_REGEX = new RegExp(`${NUM}\\s*${UNIT}\\s*de\\s*côté`, "i");

function toMeters(value, unit) {
  const v = parseFloat(value.replace(",", "."));
  if (!Number.isFinite(v)) return null;
  return (unit ?? "m").toLowerCase().startsWith("cm") ? v / 100 : v;
}

export default function extractDimensionsMeters(text) {
  if (!text) return null;

  const pair = text.match(PAIR_REGEX);
  if (pair) {
    const [, w, wUnit, h, hUnit] = pair;
    const width = toMeters(w, wUnit ?? hUnit);
    const height = toMeters(h, hUnit);
    if (width > 0 && height > 0) return { width, height };
  }

  const side = text.match(SIDE_REGEX);
  if (side) {
    const [, s, unit] = side;
    const width = toMeters(s, unit);
    if (width > 0) return { width, height: width };
  }

  return null;
}
