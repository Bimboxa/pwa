/*
 * items = [{label, id, children:[{label,children}]}, ...]
 *
 * we traverse the tree and add an id to each node if it doesn't have one.
 */

import {nanoid} from "@reduxjs/toolkit";

export default function addIdToNodes(treeItems) {
  if (!Array.isArray(treeItems)) {
    console.warn(
      "[addIdToNodes] treeItems is empty or not an array:",
      treeItems
    );
    return [];
  }

  function traverse(items) {
    return items.map((item) => {
      const newItem = {...item};
      if (!newItem.id) {
        newItem.id = nanoid();
      }
      if (newItem.children) {
        newItem.children = traverse(newItem.children);
      }
      return newItem;
    });
  }

  return traverse(treeItems);
}
