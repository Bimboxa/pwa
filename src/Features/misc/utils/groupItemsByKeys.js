/**
 * Regroupe les items selon une liste de clés.
 *
 * @param {Array} items - Les données à grouper.
 * @param {Array} keys - Les clés de regroupement (ex: ["status", "type"]).
 * @param {String} variant - Si "array", retourne un tableau d'objets groupés avec un champ label.
 */
export default function groupItemsByKeys(items, keys, variant = "") {
  if (!items || !items.length || !keys) return variant === "array" ? [] : {};

  // 1. Regroupement (Création du dictionnaire)
  const groupedMap = {};

  items.forEach((item) => {
    // Clé unique interne pour le regroupement
    const compositeKey = keys.map((key) => item[key]).join("::");

    if (!groupedMap[compositeKey]) {
      groupedMap[compositeKey] = [];
    }
    groupedMap[compositeKey].push(item);
  });

  // 2. Transformation en tableau structuré (si demandé)
  if (variant === "array") {
    return Object.values(groupedMap).map((groupItems) => {
      // On utilise le 1er item comme référence pour les valeurs du groupe
      const firstItem = groupItems[0];

      // AJOUT : On crée le label en joignant les valeurs des clés par un espace
      const label = keys.map(key => firstItem[key]).join(" ");

      const groupObject = {
        label: label, // Ex: "A Open"
        items: groupItems
      };

      // On réinjecte les clés individuelles (type: "A", status: "Open")
      keys.forEach(key => {
        groupObject[key] = firstItem[key];
      });

      return groupObject;
    });
  }

  return groupedMap;
}