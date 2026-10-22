// Base maps whose group is shown in the 3D scene: the candidates a 3D drawing
// may land on. A base map hidden in 3D (eye off → group.visible false,
// ThreedEditor.setBaseMapVisible) or not loaded in the scene does not exist
// for the drawing — a point snapped to a vertex / edge / axis lock carries no
// base map, and resolving it over every base map of the project used to pick
// a hidden plan stacked under the displayed one. The image-only eye
// (meshWrap hidden, annotations still shown) keeps the base map a candidate.
//
// Falls back to the whole list when no base map is shown (no scene / every
// plan hidden while drawing on annotation faces).
export default function filterBaseMapsShownIn3d(editor, baseMaps) {
  const list = baseMaps ?? [];
  const imagesManager = editor?.sceneManager?.imagesManager;
  if (!imagesManager?.getGroup || !list.length) return list;
  const shown = list.filter((bm) => isShown(imagesManager.getGroup(bm.id)));
  return shown.length ? shown : list;
}

function isShown(group) {
  if (!group) return false;
  let node = group;
  while (node) {
    if (node.visible === false) return false;
    node = node.parent;
  }
  return true;
}
