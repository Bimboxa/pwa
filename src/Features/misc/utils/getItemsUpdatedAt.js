import getDateString from "./getDateString";
import getSortedItems from "./getSortedItems";

export default function getItemsUpdatedAt(items) {
  // edge case
  if (!items) return null;

  // updatedAt = createdAt if exist
  items = items.map((item) => ({
    ...item,
    updatedAt: item?.updatedAt ?? item.createdAt,
  }));

  // main
  const sortedItems = getSortedItems(items, {
    sortBy: "updatedAt",
    order: "desc",
  });

  const lastItem = sortedItems[0];
  return lastItem?.updatedAt
    ? getDateString(lastItem.updatedAt)
    : getDateString(Date.now());
}
