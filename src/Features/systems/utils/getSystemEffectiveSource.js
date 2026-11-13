// Fields of the source annotation a system procedure reads.
const SOURCE_FIELDS = ["height", "offsetZ", "strokeWidth", "strokeWidthUnit"];

// The source annotation as the editors display it: a field locked on its
// template (`template.overrideFields`) takes the template value, and a field
// the row never stored falls back on the template. Returns a shallow copy —
// the stored row is never mutated.
export default function getSystemEffectiveSource(source, sourceTemplate) {
  const effective = { ...source };
  if (!sourceTemplate) return effective;
  const locked = new Set(sourceTemplate.overrideFields ?? []);
  for (const key of SOURCE_FIELDS) {
    const templateValue = sourceTemplate[key];
    if (templateValue === null || templateValue === undefined) continue;
    if (
      locked.has(key) ||
      effective[key] === null ||
      effective[key] === undefined
    )
      effective[key] = templateValue;
  }
  return effective;
}
