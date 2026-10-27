import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import {
  SCAN_PLANE_GRID_COLOR,
  SCAN_PLANE_PULSE_COLOR,
} from "../constants/scanPlanePulse";

const DURATION_MS = 2200;
const GRID_HALF_M = 1; // 2 m × 2 m
const GRID_CELL_M = 0.1;
const GRID_MAJOR_EVERY = 5; // a thicker line every 50 cm
const RING_MAX_M = 1; // sonar radius at the end of the pulse
const MARK_RADIUS_M = 0.0225;
// The grid holds, then fades out (fraction of the pulse duration).
const GRID_HOLD = 0.35;

// Segments of the grid lines lying in the XZ plane (then turned to the
// plane normal): [minor, major] flat xyz arrays.
function getGridSegments() {
  const minor = [],
    major = [];
  const count = Math.round(GRID_HALF_M / GRID_CELL_M);
  for (let i = -count; i <= count; i++) {
    const c = i * GRID_CELL_M;
    const target = i % GRID_MAJOR_EVERY === 0 ? major : minor;
    target.push(c, 0, -GRID_HALF_M, c, 0, GRID_HALF_M);
    target.push(-GRID_HALF_M, 0, c, GRID_HALF_M, 0, c);
  }
  return [minor, major];
}

// Point found on a scan, in WORLD space (metres): a dot, and on a supported
// plane an expanding sonar ring and a fading 2 m grid lying in the plane
// (fat lines, 10 cm cells, 50 cm major lines, over a light veil: a 1 px grid
// vanishes on a light point cloud). Everything fades over 2.2 s, then frees
// its geometries and materials. Shared by the Scan 3D tool inspection and
// the walk-mode laser meter. renderer: line widths are in screen pixels.
// → dispose() (also run at the end of the animation)
export default function createScanPlanePulse({
  parent,
  renderer,
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
  const gridMaterials = [];
  if (normal) {
    ring = add(new Mesh(new RingGeometry(0.94, 1, 64), material()), 10000);
    ring.position.copy(point);
    ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
    // The grid lies in XZ: Y → normal keeps a wall grid vertical/horizontal.
    grid = add(new Group(), 9999);
    grid.position.copy(point);
    grid.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal);
    const canvas = renderer?.domElement;
    const resolution = new Vector2(
      canvas?.clientWidth || 1,
      canvas?.clientHeight || 1
    );
    const veil = new Mesh(
      new PlaneGeometry(2 * GRID_HALF_M, 2 * GRID_HALF_M),
      material()
    );
    veil.rotation.x = -Math.PI / 2;
    veil.material.opacity = 0;
    veil.raycast = () => false;
    veil.renderOrder = 9998;
    grid.add(veil);
    gridMaterials.push({ material: veil.material, alpha: 0.16 });
    getGridSegments().forEach((positions, major) => {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions);
      const lineMaterial = new LineMaterial({
        color: major ? SCAN_PLANE_PULSE_COLOR : SCAN_PLANE_GRID_COLOR,
        linewidth: major ? 3 : 1.5,
        resolution,
        worldUnits: false,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const lines = new LineSegments2(geometry, lineMaterial);
      lines.raycast = () => false;
      lines.renderOrder = 9999;
      grid.add(lines);
      gridMaterials.push({ material: lineMaterial, alpha: major ? 1 : 0.75 });
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
      object.traverse((child) => {
        child.geometry?.dispose();
        [child.material].flat().forEach((m) => m?.dispose());
      });
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
    const gridFade = t < GRID_HOLD ? 1 : 1 - (t - GRID_HOLD) / (1 - GRID_HOLD);
    gridMaterials.forEach(({ material, alpha }) => {
      material.opacity = alpha * gridFade;
    });
    if (ring) {
      ring.scale.setScalar(0.08 + (RING_MAX_M - 0.08) * t);
      ring.material.opacity = (1 - t) * 0.9;
    }
    requestRender();
    frame = requestAnimationFrame(animate);
  };
  if (ring) ring.scale.setScalar(0.08);
  gridMaterials.forEach(({ material, alpha }) => {
    material.opacity = alpha;
  });
  requestRender();
  frame = requestAnimationFrame(animate);
  return dispose;
}
