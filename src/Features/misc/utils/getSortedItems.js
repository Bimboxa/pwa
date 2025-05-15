export default function getSortedItems(items, sortBy) {
  if (!items || !Array.isArray(items)) return [];

  // sortBy: may be the key or {key,order:"desc"||"asc"}
  if (typeof sortBy === "string") {
    sortBy = {key: sortBy};
  }

  // invert

  const invert = sortBy.order === "desc";

  // Sort the items based on the specified property
  const sortedItems = items.sort((a, b) => {
    if (!a.hasOwnProperty(sortBy.key) || !b.hasOwnProperty(sortBy.key)) {
      return 0; // If the property doesn't exist, treat them as equal
    }
    if (a[sortBy.key] < b[sortBy.key]) return invert ? 1 : -1;
    if (a[sortBy.key] > b[sortBy.key]) return invert ? -1 : 1;
    return 0;
  });

  return sortedItems;
}
