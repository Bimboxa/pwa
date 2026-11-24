import { Matrix4, Raycaster, Vector3 } from "three";

import {
  filterIntersectionsByClipping,
  getActiveClippingPlane,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

import { getReconstructionSceneFrame } from "../utils/applyReconstructionCameraPose";
import getReconstructionCameraOnBaseMap, {
  baseMapLocalToImagePx,
} from "../utils/getReconstructionCameraOnBaseMap";

// What a camera of a 3D reconstruction looks at, on its base map.
//
// - 3D editor alive with the model attached: the line of sight (true camera
//   of the pose, never the pulled-back 3D camera) is cast in the scene — the
//   first VISIBLE surface wins: the model, an annotation solid, a base map
//   image. Labels, photo cards, lines and sprites are let through.
// - Otherwise (2D editor before the 3D one ever loaded, nothing hit): where
//   the line of sight meets the plane of the base map, or a short reach
//   ahead of the camera when it never does.
//
// → { point: {x, y} normalized on the base map image, offsetZ (height above
//     its plane, render units), source: "SCENE" | "PLANE" | "AHEAD" } | null

const matrix = new Matrix4();
const origin = new Vector3();
const direction = new Vector3();
const raycaster = new Raycaster();

function isSurfaceHit(intersection) {
  const object = intersection.object;
  if (!object?.isMesh) return false;
  // fat lines are meshes
  if (object.isLine2 || object.isLineSegments2) return false;
  for (let o = object; o; o = o.parent) {
    if (o.userData?.isAnnotationLabelGroup) return false;
  }
  return true;
}

function normalize(px, source) {
  const { imageSize } = px;
  return {
    point: { x: px.x / imageSize.width, y: px.y / imageSize.height },
    offsetZ: px.z,
    source,
  };
}

function pickInScene(baseMap, pose) {
  const frame = getReconstructionSceneFrame(baseMap.id, matrix);
  const scene = frame?.sceneManager?.scene;
  if (!scene) return null;

  origin.fromArray(pose.position).applyMatrix4(matrix);
  direction.fromArray(pose.forward).transformDirection(matrix);
  if (direction.lengthSq() === 0) return null;

  raycaster.set(origin, direction);
  // sprites and fat lines read the camera of the raycaster
  raycaster.camera = frame.sceneManager.camera;
  let hits;
  try {
    hits = raycaster.intersectObjects(scene.children, true);
  } catch (error) {
    console.warn("[reconstruction3d] scene raycast failed", error);
    return null;
  }
  const hit = filterIntersectionsByVisibility(
    filterIntersectionsByClipping(
      hits.filter(isSurfaceHit),
      getActiveClippingPlane(frame.sceneManager)
    )
  )[0];
  if (!hit) return null;

  frame.group.updateWorldMatrix(true, false);
  const local = frame.group.worldToLocal(hit.point.clone());
  const px = baseMapLocalToImagePx(local, baseMap);
  return px ? normalize(px, "SCENE") : null;
}

export default function pickReconstructionCameraTarget({ baseMap, pose }) {
  if (!baseMap || !pose?.position || !pose?.forward) return null;

  const sceneTarget = pickInScene(baseMap, pose);
  if (sceneTarget) return sceneTarget;

  const camera = getReconstructionCameraOnBaseMap(baseMap, pose);
  if (!camera) return null;
  const imageSize =
    baseMap.getImageSize?.() ?? baseMap.image?.imageSize ?? null;
  if (!(imageSize?.width > 0 && imageSize?.height > 0)) return null;
  return normalize(
    { ...camera.target, imageSize },
    camera.targetOnPlane ? "PLANE" : "AHEAD"
  );
}
