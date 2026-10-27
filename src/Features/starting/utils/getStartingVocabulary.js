// Wording of the « Démarrer avec <scope> » dialog, from the org config
// (appConfig.strings): a scope is a « Krto » for edx, a « Mission » for lei,
// a « Dossier » by default. Every field has a French fallback.
export default function getStartingVocabulary(appConfig) {
  const strings = appConfig?.strings ?? {};

  const scopeS = strings.scope?.nameSingular ?? "Dossier";
  const scopePluralS = strings.scope?.namePlural ?? `${scopeS}s`;
  const projectS = strings.project?.nameSingular ?? "Projet";
  const projectLowerS = projectS.toLowerCase();

  // « Chantier / Opportunité / Projet »; empty when the org has one type only.
  const typeLabels = [
    ...new Set(Object.values(strings.project?.typeLabels ?? {})),
  ];
  const projectTypesS = typeLabels.length > 1 ? typeLabels.join(" / ") : "";

  const listingsS = strings.listing?.namePlural ?? "Listes";
  const scopeDescriptionS = strings.scope?.description ?? null;
  const appName = appConfig?.appName ?? "Krto";
  const startLabelS = strings.starting?.start ?? `Démarrer avec ${appName}`;

  return {
    appName,
    scopeS,
    scopePluralS,
    projectS,
    projectLowerS,
    projectTypesS,
    listingsS,
    scopeDescriptionS,
    startLabelS,
  };
}
