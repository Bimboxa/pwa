import getItemsByKey from "./getItemsByKey";

export default function intersectItems(itemsA, itemsB, key = "id") {
  let itemsAOnly;
  let itemsBOnly;
  let itemsIntersect;

  if (!itemsA || !itemsB) {
    itemsAOnly = itemsA;
    itemsBOnly = itemsB;
    itemsIntersect = [];
  } else {
    const itemsAByKey = getItemsByKey(itemsA, key);
    const itemsBByKey = getItemsByKey(itemsB, key);

    itemsAOnly = Object.values(itemsAByKey).filter(
      (item) => !itemsBByKey[item[key]]
    );
    itemsBOnly = Object.values(itemsBByKey).filter(
      (item) => !itemsAByKey[item[key]]
    );
    itemsIntersect = Object.values(itemsAByKey)
      .filter((item) => (itemsBByKey[item[key]] ? true : false))
      .map((itemA) => {
        const itemB = itemsBByKey[itemA[key]];
        return {...itemA, ...itemB};
      });
  }
  return [itemsAOnly, itemsBOnly, itemsIntersect];
}
