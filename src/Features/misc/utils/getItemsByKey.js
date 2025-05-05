export default function getItemsByKey(items, key = "id") {
  if (!items || !Array.isArray(items)) return {};

  return items.reduce((acc, item) => {
    acc[item[key]] = item;
    return acc;
  }, {});
}
