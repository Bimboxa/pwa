// Default label of a new section mark: the first free letter pair among
// "A-A" … "Z-Z", then "AA-AA" … "ZZ-ZZ", and so on. The comparison ignores
// case and surrounding spaces.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_REPEAT = 4;

const normalize = (label) =>
  String(label ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

export default function getNextBaseMapLinkLabel(existingLabels) {
  const used = new Set((existingLabels ?? []).map(normalize).filter(Boolean));
  for (let repeat = 1; repeat <= MAX_REPEAT; repeat += 1) {
    for (const letter of LETTERS) {
      const mark = letter.repeat(repeat);
      const label = `${mark}-${mark}`;
      if (!used.has(label)) return label;
    }
  }
  return "A-A";
}
