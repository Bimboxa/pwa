import {nanoid} from "@reduxjs/toolkit";

import {
  findNodeById,
  insertNodeUnderParent,
  removeNodeById,
} from "./nodesManagementUtils";

export default function manageTree(tree, args) {
  const {action, targetId, label, children, newParentId, position} = args;

  switch (action) {
    case "create_tree":
      // Full replacement
      if (!children || !Array.isArray(children)) {
        throw new Error("create_tree requires a `children` array");
      }
      return [...children];

    case "add_node":
      if (!targetId || !label) {
        throw new Error("add_node requires `targetId` (parent) and `label`");
      }
      const newNode = {
        id: nanoid(),
        label,
        children: children || [],
      };
      const inserted = insertNodeUnderParent(tree, targetId, newNode);
      if (!inserted)
        throw new Error(`Parent node with id "${targetId}" not found`);
      return tree;

    case "remove_node":
      if (!targetId) throw new Error("remove_node requires `targetId`");
      const [removedNode, updatedTree] = removeNodeById(tree, targetId);
      if (!removedNode) throw new Error(`Node with id "${targetId}" not found`);
      return updatedTree;

    case "update_node":
      if (!targetId || !label)
        throw new Error("update_node requires `targetId` and `label`");
      const nodeToUpdate = findNodeById(tree, targetId);
      if (!nodeToUpdate)
        throw new Error(`Node with id "${targetId}" not found`);
      nodeToUpdate.label = label;
      return tree;

    case "move_node": // {action:"move_node", targetId, newParentId, position}
      if (!targetId) {
        throw new Error("move_node requires `targetId` and `newParentId`");
      }
      //
      console.log("move_node", targetId, newParentId, position);
      //
      const [nodeToMove, treeAfterRemoval] = removeNodeById(tree, targetId);
      if (!nodeToMove) throw new Error(`Node with id "${targetId}" not found`);
      if (
        !insertNodeUnderParent(
          treeAfterRemoval,
          newParentId,
          nodeToMove,
          position
        )
      ) {
        throw new Error(`Parent node with id "${newParentId}" not found`);
      }
      return treeAfterRemoval;

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
