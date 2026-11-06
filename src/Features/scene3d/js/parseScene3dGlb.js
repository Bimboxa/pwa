import { Box3, DoubleSide, Group, MeshBasicMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// GLB model of a scan base map (« Scène 3D », scene3d.format "GLB").
//
// Frames: glTF is Y up, the scan frame is Z up (metres) — the glTF scene
// hangs under a root turned by Rx(+π/2): (x, y, z) glTF → (x, −z, y) scan.
// The model is NOT recentred: the zone of the base map carries the offset
// (attachScene3dGlbToBaseMapGroup: pivot / inner, like a PLY scan).

const GLTF_TO_SCAN_ROTATION_X = Math.PI / 2;

const loader = new GLTFLoader();

// GLTFLoader messages of the compressed variants (no decoder is bundled).
const COMPRESSED_PATTERN = /draco|meshopt|ktx2|basisu/i;

function parseAsync(arrayBuffer) {
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });
}

/**
 * @param {ArrayBuffer} arrayBuffer - the .glb file
 * @returns {Promise<{root: Group, bbox: {min: number[], max: number[]},
 *   vertexCount: number, faceCount: number}>} root: scan frame (Z up), never
 *   attached to a scene — consumers clone it (cloneScene3dGlbModel). Throws
 *   `error.code`: SCENE_GLB_COMPRESSED | SCENE_GLB_INVALID | SCENE_GLB_EMPTY.
 */
export default async function parseScene3dGlb(arrayBuffer) {
  let gltf;
  try {
    gltf = await parseAsync(arrayBuffer);
  } catch (cause) {
    const error = new Error(cause?.message ?? "GLB parse failed.");
    error.code = COMPRESSED_PATTERN.test(String(cause?.message ?? ""))
      ? "SCENE_GLB_COMPRESSED"
      : "SCENE_GLB_INVALID";
    throw error;
  }

  const root = new Group();
  root.rotation.x = GLTF_TO_SCAN_ROTATION_X;
  root.add(gltf.scene);
  root.updateMatrixWorld(true);

  let vertexCount = 0;
  let faceCount = 0;
  root.traverse((child) => {
    const position = child.isMesh ? child.geometry?.attributes?.position : null;
    if (!position) return;
    vertexCount += position.count;
    const index = child.geometry.index;
    faceCount += Math.floor((index ? index.count : position.count) / 3);
  });
  const box = new Box3().setFromObject(root);
  if (faceCount === 0 || box.isEmpty()) {
    disposeScene3dGlbModel({ root });
    const error = new Error("The GLB holds no mesh.");
    error.code = "SCENE_GLB_EMPTY";
    throw error;
  }

  return {
    root,
    bbox: {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    },
    vertexCount,
    faceCount,
  };
}

// Unlit material of a model material: the colour, the texture and the vertex
// colours are kept (same downgrade as an imported 3D object, see
// buildObject3DModelWrap — the viewer has no directional light outside the
// realistic modes).
export function createScene3dGlbBasicMaterial(source, { vertexColors }) {
  return new MeshBasicMaterial({
    color: source?.color ? source.color.clone() : 0xffffff,
    map: source?.map ?? null,
    vertexColors: Boolean(vertexColors),
    side: DoubleSide,
    transparent: source?.transparent ?? false,
    opacity: source?.opacity ?? 1,
  });
}

/**
 * An attachable copy of a parsed model: the hierarchy is cloned, the
 * geometries are SHARED, every material is replaced through `createMaterial`
 * (one per source material and vertex colour flag).
 *
 * @param {{root: Group}} model
 * @param {(source: Material, info: {vertexColors: boolean}) => Material} createMaterial
 * @returns {{object: Group, materials: Material[]}} materials: the created
 *   ones, to dispose by the caller.
 */
export function cloneScene3dGlbModel(model, createMaterial) {
  const object = model.root.clone(true);
  const byKey = new Map();
  const convert = (source, vertexColors) => {
    const key = `${source?.uuid}|${vertexColors ? 1 : 0}`;
    let material = byKey.get(key);
    if (!material) {
      material = createMaterial(source, { vertexColors });
      byKey.set(key, material);
    }
    return material;
  };
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const vertexColors = Boolean(child.geometry?.attributes?.color);
    child.material = Array.isArray(child.material)
      ? child.material.map((source) => convert(source, vertexColors))
      : convert(child.material, vertexColors);
  });
  return { object, materials: [...byKey.values()] };
}

// Frees the geometries, materials and textures of a parsed model.
export function disposeScene3dGlbModel(model) {
  model?.root?.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose();
    });
  });
}
