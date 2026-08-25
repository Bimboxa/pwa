import { Raycaster, Vector3 } from "three";

// Raycast the pointer against the base map image planes (userData.isBasemap)
// and return the closest hit with the cross-helper geometry: the two lines
// through the hit point, parallel to the plane's edges (its local axes),
// clipped to the image rectangle — so they always END on the plane borders.
// Returns { position, baseMapId, group, axisA: [Vector3, Vector3],
// axisB: [Vector3, Vector3] } | null.
//
// options.excludeSubtree: skip planes inside this group (e.g. the carried
// base map).
export default function intersectBaseMapPlane(
  editor,
  ndc,
  camera,
  options = {}
) {
  const scene = editor?.sceneManager?.scene;
  if (!scene || !camera) return null;
  const excludeSubtree = options.excludeSubtree ?? null;

  // Visible base map plane meshes (raycaster does not check visibility).
  const planes = [];
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.userData?.isBasemap) return;
    let parent = obj;
    while (parent) {
      if (parent.visible === false) return;
      if (excludeSubtree && parent === excludeSubtree) return;
      parent = parent.parent;
    }
    planes.push(obj);
  });
  if (!planes.length) return null;

  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(planes, false);
  if (!hits.length) return null;

  const hit = hits[0];
  const mesh = hit.object;

  // Owning base map group.
  let node = mesh;
  let group = null;
  while (node) {
    if (node.userData?.kind === "baseMap") {
      group = node;
      break;
    }
    node = node.parent;
  }
  const baseMapId = group?.userData?.baseMapId;
  if (!group || !baseMapId) return null;

  // Cross lines in the plane's LOCAL frame (PlaneGeometry in XY), clipped to
  // the image rectangle via the geometry bounding box.
  const geom = mesh.geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const local = mesh.worldToLocal(hit.point.clone());

  const toWorld = (x, y) => mesh.localToWorld(new Vector3(x, y, local.z));
  const axisA = [toWorld(bb.min.x, local.y), toWorld(bb.max.x, local.y)];
  const axisB = [toWorld(local.x, bb.min.y), toWorld(local.x, bb.max.y)];

  return {
    position: hit.point.clone(),
    baseMapId,
    group,
    axisA,
    axisB,
  };
}
