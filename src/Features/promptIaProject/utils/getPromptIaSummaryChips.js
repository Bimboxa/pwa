export const plural = (count, one, many) =>
  `${count} ${count > 1 ? many : one}`;

// Chips summing up a parsed Prompt IA output (`summary` of
// readPromptIaProjectOutputZip). `withScopes` false hides the scopes count
// (Krto creation: the single scope is the one being created).
export default function getPromptIaSummaryChips(
  summary,
  { withScopes = true } = {}
) {
  if (!summary) return [];
  return [
    ...(withScopes ? [plural(summary.scopes, "scope", "scopes")] : []),
    plural(summary.baseMaps, "fond de plan", "fonds de plan"),
    ...(summary.models3d > 0
      ? [plural(summary.models3d, "maillage 3D", "maillages 3D")]
      : []),
    plural(summary.listings, "liste", "listes"),
    plural(summary.templates, "modèle", "modèles"),
    plural(summary.annotations, "annotation", "annotations"),
    ...(summary.placements > 0
      ? [
          plural(
            summary.placements,
            "fond à positionner",
            "fonds à positionner"
          ),
        ]
      : []),
    ...(summary.documents > 0
      ? [plural(summary.documents, "document", "documents")]
      : []),
    ...(summary.businessObjects > 0
      ? [plural(summary.businessObjects, "ouvrage", "ouvrages")]
      : []),
    ...(summary.issues > 0
      ? [plural(summary.issues, "point d'attention", "points d'attention")]
      : []),
  ];
}
