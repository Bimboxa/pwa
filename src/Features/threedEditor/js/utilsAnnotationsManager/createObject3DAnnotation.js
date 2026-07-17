import { Box3, Group, MathUtils, MeshBasicMaterial, DoubleSide } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import db from "App/db/db";

import pixelToWorld from "./pixelToWorld";

// Compose two rotations:
//   1. The basemap is rotated by Rx(-π/2) so that basemap-local Z → world Y.
//   2. glTF stores models as Y-up. To make the model's Y align with world Y,
//      we pre-rotate the GLB by Rx(+π/2) so that GLB-Y → basemap-local Z →
//      world Y after the basemap transform is applied.
const GLTF_TO_BASEMAP_ROTATION_X = Math.PI / 2;

const loader = new GLTFLoader();

function parseGltfAsync(arrayBuffer) {
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });
}

// `bbox` here is already in pixel coordinates — useAnnotationsV2 resolves the
// normalized DB value to pixels at read time (same path IMAGE/RECTANGLE follow).
function bboxCenterPx(bbox) {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

// Loads the GLB referenced by an `object3D` field ({fileName, …}) from
// db.files and returns a basemap-local-Z-up `modelWrap` Group: footprint
// center at the origin, base at local Z = 0. Shared by the committed
// annotation renderer below and the placement-mode mouse preview so both
// render the exact same model.
export async function buildObject3DModelWrap(object3D, options) {
  const fileName = object3D?.fileName;
  if (!fileName) {
    console.warn("[OBJECT_3D] missing fileName", object3D);
    return null;
  }

  const fileRecord = await db.files.get(fileName);
  if (!fileRecord?.fileArrayBuffer) {
    console.warn(
      `[OBJECT_3D] file not found in db.files: ${fileName}`,
      fileRecord
    );
    return null;
  }

  let gltf;
  try {
    gltf = await parseGltfAsync(fileRecord.fileArrayBuffer);
  } catch (err) {
    console.error("[OBJECT_3D] GLTFLoader.parse failed", err);
    return null;
  }

  // Convert PBR materials (default GLTFLoader output) to MeshBasicMaterial so
  // the model renders without depending on directional lights. The 3D viewer
  // only has AmbientLight; other annotations also use MeshBasicMaterial. This
  // preserves vertex colors (vertexColors flag) and any baked-in texture map.
  // Realistic render modes skip the downgrade: the scene has a real
  // environment + key light there, so the GLB's native PBR materials shine.
  if (!options?.realisticShading)
    gltf.scene.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const oldMat = child.material;
      const newMat = new MeshBasicMaterial({
        color: oldMat.color ? oldMat.color.clone() : 0xffffff,
        map: oldMat.map ?? null,
        vertexColors: !!child.geometry?.attributes?.color,
        side: oldMat.side ?? DoubleSide,
        transparent: oldMat.transparent ?? false,
        opacity: oldMat.opacity ?? 1,
      });
      child.material = newMat;
      oldMat.dispose();
    });

  // Recenter the model: its glTF origin can be anywhere (wheel base, corner…),
  // but the 2D footprint and top view are centered on the bounding-box center.
  // Put the footprint center at the group origin (also the rotation pivot,
  // matching the 2D rotation around the bbox center) and the base on the plan.
  const modelBox = new Box3().setFromObject(gltf.scene);
  gltf.scene.position.x -= (modelBox.min.x + modelBox.max.x) / 2;
  gltf.scene.position.z -= (modelBox.min.z + modelBox.max.z) / 2;
  gltf.scene.position.y -= modelBox.min.y;

  // Pre-rotated wrapper for the glTF scene so its Y axis ends up world-Y after
  // the basemap transform.
  const modelWrap = new Group();
  modelWrap.rotation.x = GLTF_TO_BASEMAP_ROTATION_X;
  modelWrap.add(gltf.scene);

  return modelWrap;
}

export default async function createObject3DAnnotation(
  annotation,
  baseMap,
  options
) {
  const bbox = annotation?.bbox;
  if (!annotation?.object3D?.fileName || !bbox) {
    console.warn("[OBJECT_3D] missing fileName or bbox", {
      annotationId: annotation?.id,
      fileName: annotation?.object3D?.fileName,
      bbox,
    });
    return null;
  }

  const modelWrap = await buildObject3DModelWrap(annotation.object3D, options);
  if (!modelWrap) return null;

  // Outer group holds the 2D rotation (around basemap-local Z, which maps to
  // world Y after the basemap transform applied later by the dispatcher).
  // Negated: pixelToWorld mirrors the y axis (image y-down -> local y-up), so
  // the SVG rotation (clockwise on screen) maps to -theta around local Z.
  const outer = new Group();
  const center = bboxCenterPx(bbox);
  const local = pixelToWorld(center, baseMap);
  // Basemap-local Z is the plane normal: offsetZ lifts the object above the
  // plane (e.g. placed on the top face of an extruded annotation in 3D).
  outer.position.set(local.x, local.y, Number(annotation.offsetZ) || 0);
  outer.rotation.z = MathUtils.degToRad(-(annotation.rotation || 0));
  outer.add(modelWrap);

  return outer;
}
