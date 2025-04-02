import {nanoid} from "@reduxjs/toolkit";

export function findNodeById(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNodeById(node.children || [], id);
    if (found) return found;
  }
  return null;
}

export function removeNodeById(tree, id) {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) {
      const node = tree.splice(i, 1)[0];
      return [node, tree];
    }
    const [removed, newChildren] = removeNodeById(tree[i].children || [], id);
    if (removed) {
      tree[i].children = newChildren;
      return [removed, tree];
    }
  }
  return [null, tree];
}

export function insertNodeUnderParent(
  tree,
  parentId,
  nodeToInsert,
  position = null
) {
  for (const node of tree) {
    if (node.id === parentId) {
      node.children = node.children || [];
      if (
        position !== null &&
        position >= 0 &&
        position <= node.children.length
      ) {
        node.children.splice(position, 0, nodeToInsert);
      } else {
        node.children.push(nodeToInsert);
      }
      return true;
    }
    const inserted = insertNodeUnderParent(
      node.children || [],
      parentId,
      nodeToInsert,
      position
    );
    if (inserted) return true;
  }
  return false;
}

export function countNodes(tree) {
  let count = 0;
  for (const node of tree) {
    count++;
    count += countNodes(node.children || []);
  }
  return count;
}

export function cleanNodesIds(tree) {
  const seen = new Set();

  function traverse(nodes) {
    return nodes.map((node) => {
      let newNode = {...node};

      // If id is already seen, replace it
      if (seen.has(newNode.id)) {
        newNode.id = nanoid();
      }
      seen.add(newNode.id);

      // Recurse on children if any
      if (newNode.children && Array.isArray(newNode.children)) {
        newNode.children = traverse(newNode.children);
      }

      return newNode;
    });
  }

  return traverse(tree);
}
