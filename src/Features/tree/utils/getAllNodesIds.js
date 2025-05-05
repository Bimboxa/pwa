export default function getAllNodesIds(nodes) {
  // edge case

  if (!nodes) return [];

  // main
  let ids = [];

  for (const node of nodes) {
    ids.push(node.id);
    if (node.children) {
      ids = ids.concat(getAllNodesIds(node.children));
    }
  }

  return ids;
}
