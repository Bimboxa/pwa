import getFoundItems from "Features/search/getFoundItems";
import getFlatItemsFromTreeItems from "./getFlatItemsFromTreeItems";
import getSelectedNodesWithParents from "./getSelectedNodesWithParents";

export default function getNodesFromSearchText(searchText, treeItems) {
  // edge case

  if (!searchText) return treeItems;

  // all

  if (searchText === "*") return treeItems;

  // main

  const flatItems = getFlatItemsFromTreeItems(treeItems);

  const foundItems = getFoundItems({
    items: flatItems,
    searchText,
    searchKeys: ["label"],
  });

  const foundIds = foundItems.map((item) => item.id);

  return getSelectedNodesWithParents(foundIds, treeItems);
}
