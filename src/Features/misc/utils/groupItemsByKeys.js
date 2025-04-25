/*
 * items = [{key1, key2,...},...]
 * keys = ["key1", "key2"]
 *
 * result : {"key1::key2": [{key1, key2},...]}
 */
export default function groupItemsByKeys(items, keys) {
  if (!items || !keys) return {};

  const groupedItems = {};

  items.forEach((item) => {
    const keyValues = keys.map((key) => item[key]).join("::");
    if (!groupedItems[keyValues]) {
      groupedItems[keyValues] = [];
    }
    groupedItems[keyValues].push(item);
  });

  return groupedItems;
}
