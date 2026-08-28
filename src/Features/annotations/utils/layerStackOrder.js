import { generateKeyBetween } from "fractional-indexing";

// Stack ordering of layer STRIPs (`isLayer`) on one base map.
//
// `layerIndex` is a sparse fractional index (same library/pattern as the
// paint-order `orderIndex` in useMoveAnnotation). Rows without a key sort
// FIRST (bottom of the stack) by createdAt then id — keys are assigned when a
// strip becomes a layer, so that fallback only concerns legacy/imported rows.

export function sortLayerStrips(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ka = a?.layerIndex ?? null;
    const kb = b?.layerIndex ?? null;
    if (ka !== null && kb !== null) return ka.localeCompare(kb);
    if (ka !== null) return 1;
    if (kb !== null) return -1;
    const ca = a?.createdAt ?? "";
    const cb = b?.createdAt ?? "";
    if (ca !== cb) return ca.localeCompare(cb);
    return (a?.id ?? "").localeCompare(b?.id ?? "");
  });
}

// Key for a new layer placed on top of the stack.
export function getNextLayerIndexKey(rows) {
  const keys = (rows || [])
    .map((r) => r?.layerIndex)
    .filter((k) => k !== null && k !== undefined)
    .sort();
  return generateKeyBetween(keys.length ? keys[keys.length - 1] : null, null);
}

// Move one layer up ("up" = later in the stack, drawn on top) or down, then
// re-mint a full clean key sequence — O(n) with n tiny, and it sidesteps every
// fractional edge case (missing or duplicated keys from imports).
// Returns [{id, layerIndex}] for ALL layers, or [] when the move is a no-op.
export function buildReorderUpdates(rows, movedId, direction) {
  const sorted = sortLayerStrips(rows);
  const idx = sorted.findIndex((r) => r.id === movedId);
  if (idx === -1) return [];
  const target = direction === "up" ? idx + 1 : idx - 1;
  if (target < 0 || target >= sorted.length) return [];
  const reordered = [...sorted];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(target, 0, moved);
  let prev = null;
  return reordered.map((r) => {
    prev = generateKeyBetween(prev, null);
    return { id: r.id, layerIndex: prev };
  });
}
