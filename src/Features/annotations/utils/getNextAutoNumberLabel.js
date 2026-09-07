// Per-listing auto-numbering of annotation labels ("Numérotation
// automatique" listing option). Replaces the former entity `num` field with
// `increment: auto`: the number is written to the annotation's OWN `label`.
//
// listing.autoNumberPrefix   optional string prefix, e.g. "P"  → "P12"
// listing.autoNumberPadStart optional zero padding, e.g. 3     → "012"

function parseAutoNumber(label, prefix) {
  if (label == null) return NaN;
  let rest = String(label).trim();
  if (prefix) {
    if (!rest.startsWith(prefix)) return NaN;
    rest = rest.slice(prefix.length);
  }
  // Strict: the whole remainder must be digits, so template names such as
  // "Surface 2" (the default label of un-numbered annotations) never count.
  return /^\d+$/.test(rest) ? parseInt(rest, 10) : NaN;
}

export function formatAutoNumberLabel(listing, number) {
  const prefix = listing?.autoNumberPrefix || "";
  const pad = Number(listing?.autoNumberPadStart) || 0;
  const digits = pad > 0 ? String(number).padStart(pad, "0") : String(number);
  return `${prefix}${digits}`;
}

/**
 * Next auto-numbered label for `listing`, given the labels of its existing
 * annotations: max(parsed numbers) + 1, formatted with the listing's
 * prefix / padding. Non-numeric labels are ignored.
 */
export default function getNextAutoNumberLabel(listing, existingLabels) {
  const prefix = listing?.autoNumberPrefix || "";
  let max = 0;
  for (const label of existingLabels ?? []) {
    const n = parseAutoNumber(label, prefix);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return formatAutoNumberLabel(listing, max + 1);
}
