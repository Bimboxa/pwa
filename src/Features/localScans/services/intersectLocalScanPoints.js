import { Matrix4, Plane, Vector3 } from "three";

import {
  getLocalScanViews,
  isLocalScanViewDisplayed,
} from "./localScanViewRegistry";
import pickNearestScanPointOnScreen from "../utils/pickNearestScanPointOnScreen";

// Above this, the pick reads one point out of `step` and widens its radius
// by the same density ratio: the pass stays bounded on the largest clouds.
const MAX_POINTS_READ = 4_000_000;
const PICK_RADIUS_PX = 6;
const MAX_PICK_RADIUS_PX = 16;

const _inverse = new Matrix4();
const _matrix = new Matrix4();
const _plane = new Plane();
const _origin = new Vector3();
const _direction = new Vector3();
const _onRay = new Vector3();

// Point of the displayed scan clouds drawn under a screen point — the
// synchronous pick of the camera pivot (the clouds never answer a raycast;
// the Scan 3D inspection and the walk laser meter use the worker picker,
// createLocalScanRayPicker). The points hidden by the height slice or by
// the section plane are skipped.
//
// ray: world three.js Ray through the screen point.
// → {position: Vector3 (world), distance} | null
export default function intersectLocalScanPoints({ sceneManager }, ray) {
  const { camera, renderer, scene, clippingManager } = sceneManager ?? {};
  if (!camera || !renderer || !ray) return null;
  const canvas = renderer.domElement;
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  if (!width || !height) return null;
  const views = getLocalScanViews().filter((view) =>
    isLocalScanViewDisplayed(view, scene)
  );
  if (!views.length) return null;

  camera.updateMatrixWorld();
  _onRay.copy(ray.origin).add(ray.direction).project(camera);
  const ndc = [_onRay.x, _onRay.y];
  const clipPlane = clippingManager?.enabled ? clippingManager.plane : null;

  let best = null;
  for (const view of views) {
    const positions = view.data?.positions;
    if (!positions?.length) continue;
    const world = view.root.matrixWorld;
    view.root.updateMatrixWorld(true);
    _inverse.copy(world).invert();
    _origin.copy(ray.origin).applyMatrix4(_inverse);
    // unit vector in source space: depths are then in source units
    _direction.copy(ray.direction).transformDirection(_inverse);
    _matrix
      .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(world);
    const step = Math.ceil(positions.length / 3 / MAX_POINTS_READ);
    let planes = null;
    if (clipPlane) {
      _plane.copy(clipPlane).applyMatrix4(_inverse);
      planes = [[..._plane.normal.toArray(), _plane.constant]];
    }
    const hit = pickNearestScanPointOnScreen(positions, {
      matrix: _matrix.elements,
      ndc,
      width,
      height,
      origin: _origin.toArray(),
      direction: _direction.toArray(),
      step,
      radiusPx: Math.min(MAX_PICK_RADIUS_PX, PICK_RADIUS_PX * Math.sqrt(step)),
      slice: view.clipRange
        ? {
            ...view.clipRange,
            row: [1, 5, 9, 13].map((i) => world.elements[i]),
          }
        : null,
      planes,
    });
    if (!hit) continue;
    const position = new Vector3(...hit.point).applyMatrix4(world);
    const distance = position.distanceTo(ray.origin);
    if (!best || distance < best.distance) best = { position, distance };
  }
  return best;
}
