// "Dupliquer" availability for the current sub-selection of an annotation
// (useSelectedAnnotationPart): a part clone needs ONE category of parts and at
// least one usable chain / two points. Shared by the toolbar button and the
// clone flow (CloneAnnotationFlow).
export default function getCloneAnnotationPartState(part) {
  const hasPart = Boolean(part?.kind) && part.kind !== "NONE";
  const isMixedPart = hasPart && part.kind === "MIXED";
  const segmentsHasChains =
    hasPart &&
    part.kind === "SEGMENTS" &&
    Array.isArray(part.chains) &&
    part.chains.length > 0;

  const disabled =
    isMixedPart ||
    (hasPart &&
      !isMixedPart &&
      part.kind !== "SEGMENTS" &&
      (!part.pointRefs || part.pointRefs.length < 2)) ||
    (hasPart && part.kind === "SEGMENTS" && !segmentsHasChains);

  let tooltip;
  if (isMixedPart) {
    tooltip =
      "Sélectionnez une seule catégorie (segments, ouverture ou guide) pour dupliquer";
  } else if (hasPart && part.kind === "SEGMENTS" && part.chains?.length > 1) {
    tooltip = `Dupliquer (${part.chains.length} polylines créées)`;
  }

  return { hasPart, disabled, tooltip };
}
