import {
  DoubleSide,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import {
  SCAN_PLANE_GRID_COLOR,
  SCAN_PLANE_PULSE_COLOR,
} from "../constants/scanPlanePulse";

const DURATION_MS = 2200;
const GRID_SIZE_M = 2; // 2 m × 2 m, 10 cm cells
const RING_MAX_M = 1; // sonar radius at the end of the pulse
const MARK_RADIUS_M = 0.0225;

// Point found on a scan, in WORLD space (metres): a dot, and on a supported
// plane an expanding sonar ring and a fading 2 m grid lying in the plane.
// Everything fades over 2.2 s, then frees its geometries and materials.
// Shared by the Scan 3D tool inspection and the walk-mode laser meter.
// → dispose() (also run at the end of the animation)
export default function createScanPlanePulse({
  parent,
  requestRender,
  point,
  normal = null,
}) {
  const material = () =>
    new MeshBasicMaterial({
      color: SCAN_PLANE_PULSE_COLOR,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
  const objects = [];
  const add = (object, renderOrder) => {
    object.renderOrder = renderOrder;
    object.raycast = () => false;
    object.userData.isDecor = true;
    parent.add(object);
    objects.push(object);
    return object;
  };
  const mark = add(
    new Mesh(new SphereGeometry(MARK_RADIUS_M, 12, 8), material()),
    10000
  );
  mark.position.copy(point);
  let ring = null,
    grid = null;
  if (normal) {
    ring = add(new Mesh(new RingGeometry(0.94, 1, 64), material()), 10000);
    ring.position.copy(point);
    ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
    // GridHelper lies in XZ: Y → normal keeps a wall grid vertical/horizontal.
    grid = add(
      new GridHelper(
        GRID_SIZE_M,
        20,
        SCAN_PLANE_PULSE_COLOR,
        SCAN_PLANE_GRID_COLOR
      ),
      9999
    );
    grid.position.copy(point);
    grid.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal);
    Object.assign(grid.material, {
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  }
  let frame = null,
    disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    objects.forEach((object) => {
      object.removeFromParent();
      object.geometry.dispose();
      [object.material].flat().forEach((m) => m.dispose());
    });
    requestRender();
  }
  const start = performance.now();
  const animate = (now) => {
    const t = (now - start) / DURATION_MS;
    if (disposed || t >= 1) {
      frame = null;
      dispose();
      return;
    }
    mark.material.opacity = 1 - t;
    if (grid) grid.material.opacity = 0.85 * (1 - t) ** 1.5;
    if (ring) {
      ring.scale.setScalar(0.08 + (RING_MAX_M - 0.08) * t);
      ring.material.opacity = (1 - t) * 0.9;
    }
    requestRender();
    frame = requestAnimationFrame(animate);
  };
  if (ring) ring.scale.setScalar(0.08);
  requestRender();
  frame = requestAnimationFrame(animate);
  return dispose;
}
