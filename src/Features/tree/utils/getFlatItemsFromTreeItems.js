/*
 * treeItems : [{id,label,children:[{id,label,chidlren}]},...]
 * flatItems : [{id,num,label}] where num is the position in the tree: "1", "1.1","1.2","1.2.1",...
 */
export default function getFlatItemsFromTreeItems(treeItems) {
  // main

  let flatItems = [];

  function traverse(items, prefix = "", path = null) {
    items.forEach((item, index) => {
      const currentNum = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      const currentPath = path ? [...path, item.label] : [item.label];
      flatItems.push({
        ...item,
        id: item.id,
        num: currentNum,
        path: currentPath,
        label: item.label,
      });

      if (item.children && item.children.length > 0) {
        traverse(item.children, currentNum, currentPath);
      }
    });
  }

  traverse(treeItems);

  // return

  return flatItems;
}
