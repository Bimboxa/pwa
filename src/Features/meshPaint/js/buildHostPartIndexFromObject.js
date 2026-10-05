import { Matrix4, Vector3 } from "three";

import { mesh3dToLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
import { getFaceLoops } from "Features/annotationMesh3d/utils/mesh3dTopology";
import { MESH3D_Z_FIGHT_OFFSET } from "Features/threedEditor/js/utilsAnnotationsManager/buildMesh3dAnnotationObject";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import buildHostPartIndex from "Features/meshPaint/utils/buildHostPartIndex";
import hashTriangles from "Features/meshPaint/utils/hashTriangles";
import { createInsideSoupTester } from "Features/meshPaint/utils/isPointInsideSoup";

// three.js adapter of buildHostPartIndex: the paintable parts of a host
// annotation, read from its DISPLAYED 3D object (WYSIWYG: template overrides,
// thick-wall outlines, CSG carves, arc sampling are already applied).
//
// Frame: base-map-LOCAL meters (the frame of imagesManager.getGroup(baseMapId),
// z absolute: the host's offsetZ and the builders' 1 mm z-fight lift are
// part of the displayed geometry) — the frame of the stored paints.
//
// - triangles: every SOLID mesh of the host (role "SOLID"; all plain meshes
//   for untagged builders), hover / paint overlays, fat lines, sprites and
//   hidden sub-parts left out; 9 numbers per triangle.
// - A revolution shown as a display-only half (« Révolution partielle »,
//   userData.isRevolutionHalfView) is read over its FULL turn: the displayed
//   half plus its copy turned 180° about the axis. The parts, the paints and
//   their quantities are those of the real surface, whatever the view;
//   getHostHalfView gives the displayed side (the paints are clipped to it,
//   see clipPaintGeometry). Openings carved in the displayed half are
//   mirrored in the other one (the hidden half is not built).
// - exactFaces (isMesh3d hosts): the stored faces, re-based like the built
//   object (offsetZ + MESH3D_Z_FIGHT_OFFSET): islands are exactly the faces.
// - hash: hashTriangles(triangles) + the frame metrics (a recalibration
//   changes the stored ↔ local mapping even when the local soup does not).
//
// Results are cached per host root and invalidated by a signature of the
// solid geometries (uuid + attribute versions) and of their placement in the
// base map frame: a rebuild (new root) or a carve (swapped geometry) misses.

const isFatLine = (object) =>
  Boolean(object?.isLine2 || object?.isLineSegments2);

const isOverlay = (object) =>
  Boolean(object?.userData?.isHoverOverlay || object?.userData?.isPaintOverlay);

// Visible solid meshes of a host root (the root's own visibility is the
// caller's business: a host hidden behind an extrude ghost is still built).
export function getHostSolidMeshes(root) {
  if (!root) return [];
  const tagged = [];
  const untagged = [];
  const visit = (object, isRoot) => {
    if (!object || (!isRoot && object.visible === false)) return;
    if (isOverlay(object)) return;
    if (object.isMesh && !isFatLine(object)) {
      if (object.userData?.role === "SOLID") tagged.push(object);
      else untagged.push(object);
    }
    for (const child of object.children || []) visit(child, false);
  };
  visit(root, true);
  return tagged.length ? tagged : untagged;
}

const roundKey = (value) => Math.round(value * 1e6) / 1e6;

function getLocalMatrix(object, groupInverse) {
  object.updateWorldMatrix(true, false);
  return new Matrix4().multiplyMatrices(groupInverse, object.matrixWorld);
}

function getMetricsKey(metrics) {
  return metrics
    ? `${metrics.imageWidth}x${metrics.imageHeight}@${metrics.meterByPx}`
    : "";
}

// Axis of a display-only half revolution, in the mesh frame (null: the mesh
// shows its real surface).
function getHalfViewAxis(mesh) {
  const axis = mesh?.userData?.isRevolutionHalfView
    ? mesh.userData.revolutionAxis
    : null;
  return axis?.center ? axis : null;
}

function collectTriangles(meshes, groupInverse) {
  const out = [];
  const v = new Vector3();
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position) continue;
    const index = geometry.getIndex();
    const toLocal = getLocalMatrix(mesh, groupInverse);
    const count = index ? index.count : position.count;
    const usable = count - (count % 3);
    for (let i = 0; i < usable; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(
        toLocal
      );
      out.push(v.x, v.y, v.z);
    }
    // Hidden half: the displayed one turned 180° about the axis.
    const axis = getHalfViewAxis(mesh);
    if (!axis) continue;
    const { center, axisAlongNormal } = axis;
    for (let i = 0; i < usable; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i);
      if (axisAlongNormal) v.set(2 * center.x - v.x, 2 * center.y - v.y, v.z);
      else v.set(2 * center.x - v.x, v.y, 2 * center.z - v.z);
      v.applyMatrix4(toLocal);
      out.push(v.x, v.y, v.z);
    }
  }
  return Float64Array.from(out);
}

/**
 * Displayed side of a host shown as a display-only half revolution
 * (« Révolution partielle »), in base-map-local meters: {point, normal} — a
 * point of the axis and the unit direction, across the axis, toward the
 * displayed half (clipPaintGeometry's clip). Null for every other host.
 *
 * @param {import("three").Object3D} root - the host's annotation root
 * @param {import("three").Object3D} group - its base map group
 */
export function getHostHalfView(root, group) {
  if (!root || !group) return null;
  const mesh = getHostSolidMeshes(root).find(getHalfViewAxis);
  const position = mesh?.geometry?.getAttribute?.("position");
  if (!position?.count) return null;
  const { center, axisAlongNormal } = getHalfViewAxis(mesh);

  group.updateWorldMatrix(true, false);
  const groupInverse = new Matrix4().copy(group.matrixWorld).invert();
  const toLocal = getLocalMatrix(mesh, groupInverse);
  const point = new Vector3(center.x, center.y, center.z).applyMatrix4(toLocal);
  const direction = (
    axisAlongNormal ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
  )
    .transformDirection(toLocal)
    .normalize();
  // The displayed half lies on the side of its own vertices.
  const mean = new Vector3();
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    mean.add(v.fromBufferAttribute(position, i));
  }
  mean.divideScalar(position.count).applyMatrix4(toLocal).sub(point);
  mean.addScaledVector(direction, -mean.dot(direction));
  if (!(mean.length() > 1e-9)) return null;
  mean.normalize();
  return {
    point: { x: point.x, y: point.y, z: point.z },
    normal: { x: mean.x, y: mean.y, z: mean.z },
  };
}

// Stored faces of an isMesh3d host in the base map frame, z re-based like
// buildMesh3dAnnotationObject (offsetZ + z-fight lift).
function getExactFaces({ root, source, renderMetrics, groupInverse }) {
  if (!source?.isMesh3d || !source.mesh3d?.faces?.length || !renderMetrics) {
    return null;
  }
  const mesh = mesh3dToLocal(source.mesh3d, renderMetrics);
  const lift =
    root.userData?.mesh3dLift ??
    (Number(source.offsetZ) || 0) + MESH3D_Z_FIGHT_OFFSET;
  const toLocal = getLocalMatrix(root, groupInverse);
  const v = new Vector3();
  const toV = (vertexIndex) => {
    const p = mesh.vertices[vertexIndex];
    if (!p) return null;
    v.set(p.x, p.y, p.z + lift).applyMatrix4(toLocal);
    return { x: v.x, y: v.y, z: v.z };
  };
  const faces = [];
  for (const face of mesh.faces) {
    if (!(face?.loop?.length >= 3)) continue;
    const [loop, ...holes] = getFaceLoops(face);
    const contour = loop.map(toV);
    if (contour.some((p) => !p)) continue;
    faces.push({
      contour,
      holes: holes
        .map((hole) => hole.map(toV))
        .filter((hole) => hole.length >= 3 && hole.every(Boolean)),
    });
  }
  return faces.length ? faces : null;
}

function getSignature({ meshes, root, groupInverse, source, metricsKey }) {
  const parts = meshes.map((mesh) => {
    const geometry = mesh.geometry;
    const position = geometry?.getAttribute?.("position");
    const index = geometry?.getIndex?.();
    const elements = getLocalMatrix(mesh, groupInverse)
      .elements.map(roundKey)
      .join(",");
    return `${geometry?.uuid}:${position?.version ?? ""}:${
      index?.version ?? ""
    }:${elements}`;
  });
  if (source?.isMesh3d) {
    parts.push(
      `root:${getLocalMatrix(root, groupInverse).elements.map(roundKey).join(",")}`
    );
  }
  parts.push(metricsKey);
  return parts.join("|");
}

const cache = new WeakMap(); // root → {signature, source, data}

/**
 * Host part data, cached per root.
 *
 * @param {object} args
 * @param {import("three").Object3D} args.root - the host's annotation root
 * @param {import("three").Object3D} args.group - its base map group
 *   (imagesManager.getGroup(baseMapId))
 * @param {object} [args.source] - the resolved annotation the root was built
 *   from (AnnotationsManager.getAnnotationSource): isMesh3d stored faces
 *   (ignored once the displayed faces are carved)
 * @param {object} args.baseMap - imagesManager.baseMapsMap entry (frame
 *   metrics, getBaseMapForRender)
 * @returns {{triangles: Float64Array, exactFaces: Array|null, hash: string,
 *   getIndex: () => object, isInside: (point) => boolean} | null} — getIndex:
 *   buildHostPartIndex result (hash replaced by `hash`), built lazily once;
 *   isInside: ray-parity tester over `triangles` (meaningful on closed hosts
 *   only, see index.isClosed).
 */
export function getHostPartData({ root, group, source, baseMap }) {
  if (!root || !group) return null;
  const renderMetrics = getBaseMapForRender(baseMap);
  if (!renderMetrics) return null;
  const meshes = getHostSolidMeshes(root);
  if (!meshes.length) return null;

  group.updateWorldMatrix(true, false);
  const groupInverse = new Matrix4().copy(group.matrixWorld).invert();
  const metricsKey = getMetricsKey(renderMetrics);
  const signature = getSignature({
    meshes,
    root,
    groupInverse,
    source,
    metricsKey,
  });

  const cached = cache.get(root);
  if (cached && cached.signature === signature && cached.source === source) {
    return cached.data;
  }

  const triangles = collectTriangles(meshes, groupInverse);
  if (triangles.length < 9) return null;
  // A carved host (glued openings, subtractions: CSG on the displayed
  // faces) is read from its carved soup: its stored mesh3d faces have no
  // hole, a paint matched on them would cover the openings.
  const carved = meshes.some((mesh) => mesh.userData?.hasSubtraction);
  const exactFaces = carved
    ? null
    : getExactFaces({
        root,
        source,
        renderMetrics,
        groupInverse,
      });
  const hash = `${hashTriangles(triangles)}@${metricsKey}`;

  let index = null;
  let insideTester = null;
  const data = {
    triangles,
    exactFaces,
    hash,
    getIndex() {
      if (!index) {
        index = {
          ...buildHostPartIndex({
            triangles,
            exactFaces: exactFaces ?? undefined,
          }),
          hash,
        };
      }
      return index;
    },
    isInside(point) {
      if (!insideTester) insideTester = createInsideSoupTester(triangles);
      return insideTester(point);
    },
  };
  cache.set(root, { signature, source, data });
  return data;
}

/**
 * HostPartIndex of a displayed host (see getHostPartData), or null.
 */
export default function buildHostPartIndexFromObject(args) {
  return getHostPartData(args)?.getIndex() ?? null;
}
