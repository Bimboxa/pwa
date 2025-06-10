export function getTreeItemsFromFlatItems(flatItems) {
  // First, sort the flat items by their num to ensure correct insertion order
  const sortedItems = [...flatItems].sort((a, b) => {
    const aParts = a.num.split(".").map(Number);
    const bParts = b.num.split(".").map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });

  const root = [];

  // Map from num to node reference
  const numMap = {};

  for (const item of sortedItems) {
    const node = {
      id: item.id,
      label: item.label,
      children: [],
    };
    numMap[item.num] = node;

    const parentNum = item.num.split(".").slice(0, -1).join(".");
    if (parentNum) {
      const parent = numMap[parentNum];
      if (parent) {
        parent.children.push(node);
      }
    } else {
      root.push(node);
    }
  }

  return root;
}
