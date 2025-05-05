export default function getSelectedNodesWithParents(selectedIds, tree) {
  if (!selectedIds || !tree) return [];

  function helper(node) {
    let children = (node.children || [])
      .map(helper)
      .filter((child) => child !== null);

    const isSelected = selectedIds.includes(node.id);

    if (isSelected || children.length > 0) {
      return {
        ...node,
        children,
      };
    }

    return null;
  }

  return tree.map(helper).filter((node) => node !== null);
}
