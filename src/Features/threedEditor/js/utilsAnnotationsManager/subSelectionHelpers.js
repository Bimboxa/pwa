import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";

// Visual constants for the vertex/edge sub-selection helpers.
// Bright fluo green for hover, fluo yellow for the persistent selected state.
const COLOR_HOVER = 0x00ff00;
const COLOR_SELECTED = 0xffff00;
const VERTEX_RADIUS_RATIO = 0.012; // ~1.2% of the annotation bbox diagonal
const VERTEX_RADIUS_MIN = 0.03; // meters (avoid invisible spheres on tiny faces)

function getVertexRadius(annoObject) {
  const bbox = new Box3().setFromObject(annoObject);
  if (!isFinite(bbox.min.x)) return VERTEX_RADIUS_MIN;
  const size = new Vector3();
  bbox.getSize(size);
  const diag = size.length();
  return Math.max(VERTEX_RADIUS_MIN, diag * VERTEX_RADIUS_RATIO);
}

function makeVertexMesh(color, radius) {
  const geom = new SphereGeometry(radius, 16, 12);
  const mat = new MeshBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const mesh = new Mesh(geom, mat);
  mesh.renderOrder = 999;
  return mesh;
}

function makeEdgeLine(color, a, b) {
  const geom = new BufferGeometry();
  geom.setAttribute(
    "position",
    new Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3)
  );
  const mat = new LineBasicMaterial({
    color,
    depthTest: false,
    linewidth: 4, // ignored on most platforms but harmless
    transparent: true,
    opacity: 0.95,
  });
  const line = new Line(geom, mat);
  line.renderOrder = 999;
  return line;
}

function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
  obj.parent?.remove(obj);
}

function localToWorldVec3(annoObject, localPos) {
  const v = new Vector3(localPos.x, localPos.y, localPos.z);
  annoObject.localToWorld(v);
  return v;
}

// Build a vertex helper Mesh positioned at the given vertex index of the
// annotation. Caller is responsible for adding it to the scene + disposing
// via disposeSubSelectionHelper.
export function buildVertexHelper(annoObject, vertexIndex, opts = {}) {
  const refs = annoObject?.userData?.vertexRefs;
  if (!refs || refs[vertexIndex] == null) return null;
  const ref = refs[vertexIndex];
  const radius = opts.radius ?? getVertexRadius(annoObject);
  const color = opts.selected ? COLOR_SELECTED : COLOR_HOVER;
  const mesh = makeVertexMesh(color, radius);
  const world = localToWorldVec3(annoObject, ref.position);
  mesh.position.copy(world);
  mesh.userData.kind = "VERTEX_HELPER";
  return mesh;
}

// Build an edge helper Line between two vertex indices.
export function buildEdgeHelper(annoObject, vertexIndexA, vertexIndexB, opts = {}) {
  const refs = annoObject?.userData?.vertexRefs;
  if (!refs || refs[vertexIndexA] == null || refs[vertexIndexB] == null) return null;
  const a = localToWorldVec3(annoObject, refs[vertexIndexA].position);
  const b = localToWorldVec3(annoObject, refs[vertexIndexB].position);
  const color = opts.selected ? COLOR_SELECTED : COLOR_HOVER;
  const line = makeEdgeLine(color, a, b);
  line.userData.kind = "EDGE_HELPER";
  return line;
}

// Dispose a helper previously built by buildVertexHelper / buildEdgeHelper.
export function disposeSubSelectionHelper(helper) {
  disposeObject(helper);
}

// Project a basemap-local 3D point to client (window) coordinates using the
// annotation object's parent transform stack. Returns null if behind camera.
export function projectVertexToClient(annoObject, vertexIndex, camera, canvasRect) {
  const refs = annoObject?.userData?.vertexRefs;
  if (!refs || refs[vertexIndex] == null) return null;
  const world = localToWorldVec3(annoObject, refs[vertexIndex].position);
  const projected = world.clone().project(camera);
  // Behind the camera in NDC space — projected.z > 1 in this case.
  if (projected.z > 1) return null;
  const sx = canvasRect.left + (projected.x * 0.5 + 0.5) * canvasRect.width;
  const sy = canvasRect.top + (-projected.y * 0.5 + 0.5) * canvasRect.height;
  return { x: sx, y: sy };
}

// Find the closest vertex of `annoObject` to the cursor in screen-space.
// Returns { index, distance } or null when refs are missing / nothing under
// `maxDistance` pixels.
export function findClosestVertexToCursor(
  annoObject,
  cursorClient,
  camera,
  canvasRect,
  maxDistance = 12
) {
  const refs = annoObject?.userData?.vertexRefs;
  if (!refs) return null;
  let bestIndex = -1;
  let bestDistSq = maxDistance * maxDistance;
  for (let i = 0; i < refs.length; i++) {
    const screen = projectVertexToClient(annoObject, i, camera, canvasRect);
    if (!screen) continue;
    const dx = screen.x - cursorClient.x;
    const dy = screen.y - cursorClient.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return null;
  return { index: bestIndex, distance: Math.sqrt(bestDistSq) };
}

// Find the closest edge of `annoObject` to the cursor in screen-space.
// Edges are pairs (i, (i+1) % n) since the consumer of this helper only ever
// runs against closed faces (POLYGON / RECTANGLE). Returns { indexA, indexB,
// distance } or null.
export function findClosestEdgeToCursor(
  annoObject,
  cursorClient,
  camera,
  canvasRect,
  maxDistance = 8
) {
  const refs = annoObject?.userData?.vertexRefs;
  if (!refs || refs.length < 2) return null;
  const screens = refs.map((_, i) =>
    projectVertexToClient(annoObject, i, camera, canvasRect)
  );
  const n = refs.length;
  let bestA = -1;
  let bestB = -1;
  let bestDistSq = maxDistance * maxDistance;
  for (let i = 0; i < n; i++) {
    const a = screens[i];
    const b = screens[(i + 1) % n];
    if (!a || !b) continue;
    const distSq = pointToSegmentDistanceSq(cursorClient, a, b);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestA = i;
      bestB = (i + 1) % n;
    }
  }
  if (bestA < 0) return null;
  return { indexA: bestA, indexB: bestB, distance: Math.sqrt(bestDistSq) };
}

function pointToSegmentDistanceSq(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-9) {
    const dx0 = p.x - a.x;
    const dy0 = p.y - a.y;
    return dx0 * dx0 + dy0 * dy0;
  }
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy;
}
