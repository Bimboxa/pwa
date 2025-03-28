export default function getContextContentManageZonesTree(zonesTree) {
  const treeS = JSON.stringify(zonesTree, null, 2);

  const content = `Tu pars de l'arbre de zones suivant: ${treeS}`;

  return content;
}
