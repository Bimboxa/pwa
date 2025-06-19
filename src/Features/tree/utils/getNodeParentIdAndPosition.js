/**
 * Finds the position of a node within a nested tree structure.
 *
 * @param {Array<Object>} tree - The array of tree nodes, where each node has
 * an 'id', 'label', and an optional 'children' array.
 * @param {string} targetNodeId - The ID of the node to find.
 * @returns {Object|null} An object containing `parentId` (string or null for root nodes)
 * and `index` (number), or `null` if the node is not found.
 */

export default function getNodeParentIdAndPosition(targetNodeId, tree) {
  /**
   * Recursive helper function to search for the node.
   * @param {Array<Object>} nodes - The current array of nodes to search through.
   * @param {string|null} currentParentId - The ID of the parent of the `nodes` array.
   * @returns {Object|null} Position object or null.
   */

  // edge case

  if (targetNodeId === null) {
    return {
      parentId: null,
      position: tree.length,
    };
  }

  // main

  function searchNodes(nodes, currentParentId) {
    if (!nodes) {
      return null;
    }

    // Iterate through the current level of nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // If the current node's ID matches the targetNodeId, we found it!
      if (node.id === targetNodeId) {
        return {
          parentId: currentParentId, // The parent ID we passed down
          position: i, // The index of the node in its parent's children array
        };
      }

      // If the node has children, recursively search within them
      if (node.children && node.children.length > 0) {
        const foundInChildBranch = searchNodes(node.children, node.id);
        // If the node was found in a descendant branch, return its position immediately
        if (foundInChildBranch) {
          return foundInChildBranch;
        }
      }
    }

    // If the loop finishes and the node was not found at this level or in its children, return null
    return null;
  }

  // Start the search from the root of the tree, with no initial parent (null)
  return searchNodes(tree, null);
}
