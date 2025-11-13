export default function getItemsByKey(items, key = "id") {
  if (!items || !Array.isArray(items)) return {};

  return items.reduce((acc, item) => {
    if (!item) return acc;
    acc[item[key]] = item;
    return acc;
  }, {});
}
