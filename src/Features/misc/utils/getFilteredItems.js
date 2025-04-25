/*
 * items = [{key1, key2,...}]
 * filters = [{key:"key2",value:"xx"}, {key:"key1",in:["1","2"]}]
 */

/**
 * Filtre un tableau d'objets selon un tableau de filtres.
 *
 * @param {Array<Object>} items - Les objets à filtrer.
 * @param {Array<Object>} filters - Les filtres à appliquer.
 * @returns {Array<Object>} - Les objets filtrés.
 */

export default function getFilteredItems(items, filters) {
  return items.filter((item) =>
    filters.every((filter) => {
      const value = item[filter.key];
      if ("value" in filter) {
        return value === filter.value;
      }
      if ("in" in filter && Array.isArray(filter.in)) {
        return filter.in.includes(value);
      }
      return true; // Aucun filtre applicable => ne pas exclure
    })
  );
}
