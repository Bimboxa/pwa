export default function getNodesToExpand(treeItems, selectedIds) {
  const expanded = new Set();

  function traverse(items, parentId = null) {
    items.forEach((item) => {
      if (selectedIds.includes(item.id)) {
        let currentParentId = parentId;
        // Add all ancestors of the selected node to the expanded set
        while (currentParentId) {
          expanded.add(currentParentId);
          currentParentId = parentMap.get(currentParentId);
        }
      }
      if (item.children) {
        traverse(item.children, item.id);
      }
    });
  }

  // Build a parent map to track parent-child relationships
  const parentMap = new Map();
  function buildParentMap(items, parentId = null) {
    items.forEach((item) => {
      parentMap.set(item.id, parentId);
      if (item.children) {
        buildParentMap(item.children, item.id);
      }
    });
  }

  if (!Array.isArray(treeItems) || treeItems.length === 0) {
    console.warn(
      "[getNodesToExpand] treeItems is empty or not an array:",
      treeItems
    );
    return [];
  }

  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    console.warn(
      "[getNodesToExpand] selectedIds is empty or not an array:",
      selectedIds
    );
    return [];
  }

  // Build the parent map
  buildParentMap(treeItems);

  // Traverse the tree and expand all ancestors of selected nodes
  traverse(treeItems);

  console.log("getNodesToExpand", expanded, treeItems, selectedIds);

  return Array.from(expanded).filter(Boolean); // Remove null or undefined values
}
