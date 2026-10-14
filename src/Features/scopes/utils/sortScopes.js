// ---------------------------------------------------------------------------
// sortScopes — display order of a project's scopes (Krtos).
//
// 1. by `sortIndex` (fractional-indexing key, compared byte-wise — same rule
//    as the POV previews), scopes without a sortIndex after the ranked ones;
// 2. ties / unranked scopes fall back to the name (numeric, accent-insensitive).
//
// Three-way comparator so the name tie-break applies on equal keys (e.g. a
// duplicated scope carries the sortIndex of its source).
// ---------------------------------------------------------------------------

function compareSortIndex(a, b) {
  const ka = a?.sortIndex;
  const kb = b?.sortIndex;
  if (ka == null && kb == null) return 0;
  if (ka == null) return 1;
  if (kb == null) return -1;
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return 0;
}

function compareName(a, b) {
  return (a?.name ?? "").localeCompare(b?.name ?? "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function sortScopes(scopes) {
  return [...(scopes ?? [])].sort(
    (a, b) => compareSortIndex(a, b) || compareName(a, b)
  );
}
