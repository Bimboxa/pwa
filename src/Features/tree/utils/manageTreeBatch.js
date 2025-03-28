import manageTree from "./manageTree";

export default function manageTreeBatch(tree, actions) {
  let updatedTree = tree;
  for (const actionArgs of actions) {
    updatedTree = manageTree(updatedTree, actionArgs);
  }
  return updatedTree;
}
