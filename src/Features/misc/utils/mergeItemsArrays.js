import getItemsByKey from "./getItemsByKey";

export default function mergeItemsArrays(items1, items2, key) {
  const items1ByKey = getItemsByKey(items1, key);
  const items2ByKey = getItemsByKey(items2, key);
  //
  const items1Keys = Object.keys(items1ByKey);
  const items2Keys = Object.keys(items2ByKey);

  //
  const allKeys = [...new Set([...items1Keys, ...items2Keys])];

  //
  const items = allKeys.map((key) => {
    const item1 = items1ByKey[key] || {};
    const item2 = items2ByKey[key] || {};
    return {...item1, ...item2};
  });

  return items;
}
