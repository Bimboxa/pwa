/*
 * treeItems : [{id,label,children:[{id,label,chidlren}]},...]
 * flatItems : [{id,num,label}] where num is the position in the tree: "1", "1.1","1.2","1.2.1",...
 */
export default function getFlatItemsFromTreeItems(treeItems) {
  const flatItems = [];

  function traverse(items, prefix = "") {
    items.forEach((item, index) => {
      const currentNum = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      flatItems.push({
        id: item.id,
        num: currentNum,
        label: item.label,
      });

      if (item.children && item.children.length > 0) {
        traverse(item.children, currentNum);
      }
    });
  }

  traverse(treeItems);
  return flatItems;
}
