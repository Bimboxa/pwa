// Toast shown when an annotation of a listing linked from another scope
// ("Depuis un autre Krto") is created / modified / deleted in the host scope.
// Org wording via appConfig strings.listing.linkedReadOnly; the JS fallback is
// mandatory (org yaml replaces appConfig_default.yaml wholesale).
export default function getLinkedListingReadOnlyMessage(appConfig) {
  return (
    appConfig?.strings?.listing?.linkedReadOnly ??
    "Cette liste vient d'un autre plan de repérage : modifiez-la depuis celui-ci"
  );
}
