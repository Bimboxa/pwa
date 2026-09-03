/*
 * Configurations offered by the compact creation dialog (device preference
 * "Gestion des configurations" off). `simpleModeKeys` (yaml) restricts and
 * orders them; absent => every configuration, registry order.
 */
export default function getSimpleModeConfigurations(krtoConfigurations) {
  const items = krtoConfigurations?.items ?? [];
  const keys = krtoConfigurations?.simpleModeKeys;
  if (!Array.isArray(keys)) return items;
  return keys
    .map((key) => items.find((item) => item.key === key))
    .filter(Boolean);
}
