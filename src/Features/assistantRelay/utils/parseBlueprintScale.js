// "1:200", "200", "1/200", 200 → "200" (denominator as a string, the
// convention of s.baseMapCreator.blueprintScale). null when unparsable.
export default function parseBlueprintScale(input) {
  if (input == null || input === "") return null;
  const m = String(input)
    .trim()
    .match(/^(?:1\s*[:/]\s*)?(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}
