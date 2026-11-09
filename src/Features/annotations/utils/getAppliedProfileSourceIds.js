// Helpers of the « Forme par défaut » chip for the profile DRAWINGS applied
// on a POLYLINE as inline profile lines (profileLines[i].sourceAnnotationId —
// « Ajouter un profil », or the menu's profile tiles).

/** Distinct source ids of the annotation's generated profile lines. */
export default function getAppliedProfileSourceIds(annotation) {
  return new Set(
    (annotation?.profileLines ?? [])
      .map((l) => l?.sourceAnnotationId)
      .filter(Boolean)
  );
}

/** Sorted, joinable signature of a Set of ids (batch uniformity checks). */
export function profileSourceIdsSignature(ids) {
  return [...ids].sort().join("|");
}

/**
 * Chip label for a line carrying profile drawings and no other shape3D:
 * « Profil · <name> » for one source (name from the scope's profile list,
 * falling back to « Profil »), « <n> profils » beyond.
 */
export function getAppliedProfileChipLabel(appliedSourceIds, profiles) {
  const n = appliedSourceIds.size;
  if (n === 0) return null;
  if (n > 1) return `${n} profils`;
  const [id] = appliedSourceIds;
  const label = profiles?.find((p) => p.id === id)?.label;
  return label ? `Profil · ${label}` : "Profil";
}
