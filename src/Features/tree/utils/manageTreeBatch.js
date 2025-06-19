import manageTree from "./manageTree";

export default function manageTreeBatch(tree, actions) {
  let updatedTree = tree;
  for (const actionArgs of actions) {
    const result = manageTree(updatedTree, actionArgs);
    updatedTree = result.updatedTree;
  }
  return updatedTree;
}
