import { Vector3 } from "three";

import collectAnnotationSectionMeshes from "Features/threedEditor/js/utilsClipping/collectAnnotationSectionMeshes";

// Display-only half revolution (« demi-vue », userData.isRevolutionHalfView,
// see createAnnotationObject3D): only the half facing away from the camera is
// built, the real surface is the full turn. The hidden half is the displayed
// one turned 180° about the axis — shared by the « Pinceau »
// (buildHostPartIndexFromObject) and the cut lines (collectSceneTriangles,
// ThreedCutLineAnnotations).

// Vertices this close (m) to the plane holding the axis are ON the boundary
// between the two halves.
const BOUNDARY_EPS_M = 1e-4;

// Axis of a display-only half revolution, in the mesh frame (null: the mesh
// shows its real surface).
export function getHalfViewAxis(mesh) {
  const axis = mesh?.userData?.isRevolutionHalfView
    ? mesh.userData.revolutionAxis
    : null;
  return axis?.center ? axis : null;
}

// Turns a mesh-frame point 180° about the axis, in place.
export function turnAboutHalfViewAxis(v, axis) {
  const { center, axisAlongNormal } = axis;
  if (axisAlongNormal) v.set(2 * center.x - v.x, 2 * center.y - v.y, v.z);
  else v.set(2 * center.x - v.x, v.y, 2 * center.z - v.z);
  return v;
}

/**
 * Boundary of a half-view mesh, in the mesh frame: { axis, center, normal }
 * — a point of the axis and the unit direction, across the axis, toward the
 * DISPLAYED half (it lies on the side of its own vertices). Null for every
 * other mesh.
 */
export function getHalfViewFrame(mesh) {
  const axis = getHalfViewAxis(mesh);
  const position = mesh?.geometry?.getAttribute?.("position");
  if (!axis || !position?.count) return null;
  const center = new Vector3(axis.center.x, axis.center.y, axis.center.z);
  const direction = axis.axisAlongNormal
    ? new Vector3(0, 0, 1)
    : new Vector3(0, 1, 0);
  const mean = new Vector3();
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    mean.add(v.fromBufferAttribute(position, i));
  }
  mean.divideScalar(position.count).sub(center);
  mean.addScaledVector(direction, -mean.dot(direction));
  if (!(mean.length() > 1e-9)) return null;
  return { axis, center, normal: mean.normalize() };
}

// A triangle lying in the boundary plane: a section cap closing the half of
// a SOLID revolution (buildRevolutionSolidGeometry) — no face of the real,
// full-turn object.
export function isHalfViewCapTriangle(a, b, c, frame) {
  const side = (p) =>
    (p.x - frame.center.x) * frame.normal.x +
    (p.y - frame.center.y) * frame.normal.y +
    (p.z - frame.center.z) * frame.normal.z;
  return (
    Math.abs(side(a)) < BOUNDARY_EPS_M &&
    Math.abs(side(b)) < BOUNDARY_EPS_M &&
    Math.abs(side(c)) < BOUNDARY_EPS_M
  );
}

/**
 * Hidden halves of the visible half-view meshes of the scene, in WORLD space
 * (the input of splitCutLineSegmentByHalfView):
 *   [{ point, normal, triangles, box }]
 * point / normal: the half-space dot(p - point, normal) ≥ 0 is displayed;
 * triangles: the hidden half (9 numbers per triangle, section caps left
 * out); box: its bounds { min, max }.
 */
export function collectHalfViewHosts(annotationsManager) {
  const hosts = [];
  const meshes = collectAnnotationSectionMeshes(annotationsManager, {
    visibleOnly: true,
  });
  const va = new Vector3();
  const vb = new Vector3();
  const vc = new Vector3();
  for (const mesh of meshes) {
    const frame = getHalfViewFrame(mesh);
    if (!frame) continue;
    mesh.updateWorldMatrix(true, false);
    const m = mesh.matrixWorld;
    const position = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : position.count;
    const triangles = [];
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    const read = (i, out) =>
      out.fromBufferAttribute(position, index ? index.getX(i) : i);
    for (let i = 0; i + 2 < count; i += 3) {
      read(i, va);
      read(i + 1, vb);
      read(i + 2, vc);
      if (isHalfViewCapTriangle(va, vb, vc, frame)) continue;
      for (const v of [va, vb, vc]) {
        turnAboutHalfViewAxis(v, frame.axis).applyMatrix4(m);
        triangles.push(v.x, v.y, v.z);
        min.x = Math.min(min.x, v.x);
        min.y = Math.min(min.y, v.y);
        min.z = Math.min(min.z, v.z);
        max.x = Math.max(max.x, v.x);
        max.y = Math.max(max.y, v.y);
        max.z = Math.max(max.z, v.z);
      }
    }
    if (!triangles.length) continue;
    const point = frame.center.clone().applyMatrix4(m);
    const normal = frame.normal.clone().transformDirection(m);
    hosts.push({
      point: { x: point.x, y: point.y, z: point.z },
      normal: { x: normal.x, y: normal.y, z: normal.z },
      triangles: Float64Array.from(triangles),
      box: { min, max },
    });
  }
  return hosts;
}
