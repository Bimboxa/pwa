export default function getSortedItems(items, sortBy) {
  if (!items || !Array.isArray(items)) return [];

  // Sort the items based on the specified property
  const sortedItems = items.sort((a, b) => {
    if (!a.hasOwnProperty(sortBy) || !b.hasOwnProperty(sortBy)) {
      return 0; // If the property doesn't exist, treat them as equal
    }
    if (a[sortBy] < b[sortBy]) return -1;
    if (a[sortBy] > b[sortBy]) return 1;
    return 0;
  });

  return sortedItems;
}
