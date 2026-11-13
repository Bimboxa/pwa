// Every renderable solid Mesh of every annotation object of the scene (a
// single annotation can hold several meshes: multi-segment POLYLINE walls,
// REVOLUTION runs, …) — the meshes a plane section makes sense on. Base map
// image planes are intentionally excluded (slicing the flat image yields a
// meaningless line, not a shape contour). Shared by SectionContourManager
// (clipping plane contour) and the cut lines (Features/threedCutLines).
//
// options.visibleOnly: drop the meshes hidden by their own or an ancestor's
// `visible` flag (a hidden annotation / listing must not steer a cut line).
export default function collectAnnotationSectionMeshes(
  annotationsManager,
  { visibleOnly = false } = {}
) {
  const meshes = [];
  const map = annotationsManager?.annotationsObjectsMap || {};
  Object.values(map).forEach((object) => {
    collectObjectSectionMeshes(object, { visibleOnly }, meshes);
  });
  return meshes;
}

// Same, for ONE annotation object (pushed into `meshes`, returned).
export function collectObjectSectionMeshes(
  object,
  { visibleOnly = false } = {},
  meshes = []
) {
  if (visibleOnly && object && !object.visible) return meshes;
  object?.traverse?.((child) => {
    // Fat lines (LineSegments2) ARE isMesh but hold instanced segment
    // geometry, not solid triangles — sectioning them yields garbage
    // (aquarelle ink edges, revolution section markers).
    if (child.isLine2 || child.isLineSegments2) return;
    if (child.userData?.isSectionMarker) return;
    // scan base maps: their geometry lives on the GPU only.
    if (child.userData?.isDecor) return;
    // Face stipples (hover, selected faces): copies of a face's triangles.
    if (child.userData?.isHoverOverlay) return;
    // Painted parts (Pinceau): skins over a face, not a solid.
    if (child.userData?.isPaintOverlay) return;
    if (!child.isMesh || !child.geometry) return;
    if (visibleOnly && !isChainVisible(child, object)) return;
    meshes.push(child);
  });
  return meshes;
}

// `visible` of the mesh and of every ancestor up to the annotation root.
function isChainVisible(mesh, root) {
  let node = mesh;
  while (node) {
    if (!node.visible) return false;
    if (node === root) return true;
    node = node.parent;
  }
  return true;
}
