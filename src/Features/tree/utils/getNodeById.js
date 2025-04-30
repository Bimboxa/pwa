/*
 * tree = [{label, id, children:[{label,children}]}, ...]
 */

export default function getNodeById(id, tree) {
  if (!Array.isArray(tree)) {
    console.warn("[getNodeById] tree is empty or not an array:", tree);
    return null;
  }

  function traverse(items) {
    for (const item of items) {
      if (item.id === id) {
        return item;
      }
      if (item.children) {
        const found = traverse(item.children);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  return traverse(tree);
}
