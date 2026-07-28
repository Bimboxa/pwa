// Full name of a library object: the main label plus its variant when the
// manifest declares one — "Polyligne" + "Longueur fixe" → "Polyligne — Longueur
// fixe". The card / list row show the two parts stacked (label + subtitle); this
// is the one-line form, used where the object must stay identifiable on its own
// (the "modèle déjà présent" dialog).
//
// NOT for the created annotation template's label: that one keeps the main label
// only, since the variant describes the drawing method ("Dessiner des bandes"),
// not the annotation itself.
export default function getObjectFullLabel(object) {
  if (!object) return "";
  const label = object.label ?? "";
  return object.labelVariant ? `${label} — ${object.labelVariant}` : label;
}
