// nomenclature = {...,items:[{id,label,children:[...]}]}
export default function getNomenclatureItemLabels(itemId, nomenclature) {
  if (!itemId && !nomenclature?.items?.length) {
    return { label: null, contextLabel: null };
  }

  if (!itemId && nomenclature) {
    return { label: nomenclature?.name ?? "-?-" };
  }

  let result = null;

  const traverse = (nodes, parentStack) => {
    if (!Array.isArray(nodes) || result) return;

    for (const node of nodes) {
      if (!node) continue;

      const currentParents = [...parentStack];

      if (node.id === itemId) {
        const contextLabel =
          currentParents
            .map((parent) => parent?.label)
            .filter(Boolean)
            .join(" | ") || null;

        result = {
          label: node?.label ?? null,
          contextLabel,
        };
        return;
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        traverse(node.children, [...currentParents, node]);
      }

      if (result) return;
    }
  };

  traverse(nomenclature.items, []);

  if (result) return result;

  return { label: null, contextLabel: null };
}
