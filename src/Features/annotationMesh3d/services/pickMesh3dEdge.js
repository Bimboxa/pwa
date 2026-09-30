import { Raycaster, Vector2, Vector3 } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import { isWorldPointVisible } from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";

// Slack (m) of the "is this edge point hidden behind a face" test: the faces
// the edge belongs to are hit at the very same distance.
const OCCLUSION_TOL_M = 0.02;

// The edge lines of a mesh annotation object (buildMesh3dAnnotationObject):
// LineSegments whose i-th segment is the mesh edge userData.mesh3dEdges[i].
export function getMesh3dEdgeLines(annoObject) {
  let lines = null;
  annoObject?.traverse?.((child) => {
    if (!lines && child.userData?.mesh3dEdges) lines = child;
  });
  return lines;
}

// World end points of every edge of a mesh annotation object:
// [{ a, b, pa: Vector3, pb: Vector3 }].
export function getMesh3dEdgesWorld(annoObject) {
  const lines = getMesh3dEdgeLines(annoObject);
  const position = lines?.geometry?.getAttribute("position");
  if (!position) return [];
  lines.updateWorldMatrix(true, false);
  return lines.userData.mesh3dEdges.map(([a, b], i) => ({
    a,
    b,
    pa: new Vector3()
      .fromBufferAttribute(position, 2 * i)
      .applyMatrix4(lines.matrixWorld),
    pb: new Vector3()
      .fromBufferAttribute(position, 2 * i + 1)
      .applyMatrix4(lines.matrixWorld),
  }));
}

// Mesh edge under the cursor, in screen space: the closest edge within
// `thresholdPx`, ignoring the ones hidden behind the annotation's own faces
// (or cut away by the clipping plane). Returns { a, b, pa, pb, length }
// (vertex indices, world end points, length in meters) or null.
//
// cursor: { x, y } client coords. rect: the canvas bounding rect.
export default function pickMesh3dEdge(
  annoObject,
  cursor,
  camera,
  rect,
  thresholdPx = 8,
  clippingPlane = null
) {
  const edges = getMesh3dEdgesWorld(annoObject);
  if (!edges.length || !camera || !rect?.width) return null;

  const toScreen = (p) => {
    const v = p.clone().project(camera);
    if (v.z < -1 || v.z > 1) return null;
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  };

  const candidates = [];
  for (const edge of edges) {
    const sa = toScreen(edge.pa);
    const sb = toScreen(edge.pb);
    if (!sa || !sb) continue;
    const dx = sb.x - sa.x;
    const dy = sb.y - sa.y;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 1e-6) {
      t = ((cursor.x - sa.x) * dx + (cursor.y - sa.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const distance = Math.hypot(
      cursor.x - (sa.x + t * dx),
      cursor.y - (sa.y + t * dy)
    );
    if (distance > thresholdPx) continue;
    candidates.push({
      edge,
      distance,
      point: edge.pa.clone().lerp(edge.pb, t),
    });
  }
  if (!candidates.length) return null;
  candidates.sort((c1, c2) => c1.distance - c2.distance);

  const faces = [];
  annoObject.traverse((child) => {
    if (child.isMesh && child.userData?.mesh3dFaceIndex !== undefined) {
      faces.push(child);
    }
  });
  const raycaster = new Raycaster();
  const origin = camera.getWorldPosition(new Vector3());

  for (const { edge, point } of candidates) {
    if (!isWorldPointVisible(clippingPlane, point)) continue;
    const toPoint = point.clone().sub(origin);
    const pointDistance = toPoint.length();
    if (pointDistance < 1e-6) continue;
    raycaster.set(origin, toPoint.normalize());
    const hit = raycaster.intersectObjects(faces, false)[0];
    if (hit && hit.distance < pointDistance - OCCLUSION_TOL_M) continue;
    return {
      a: edge.a,
      b: edge.b,
      pa: edge.pa,
      pb: edge.pb,
      length: edge.pa.distanceTo(edge.pb),
    };
  }
  return null;
}

// Thick screen-space line over one mesh edge (world end points) — the hover
// feedback of pickMesh3dEdge. Invisible to raycasts and to the snap index.
// The caller adds it to the scene and disposes geometry + material.
export function buildMesh3dEdgeHelper(pa, pb, { color, domElement }) {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]);
  const line = new LineSegments2(
    geometry,
    new LineMaterial({
      color,
      linewidth: 5,
      resolution: new Vector2(
        domElement?.clientWidth || 1,
        domElement?.clientHeight || 1
      ),
      worldUnits: false,
      transparent: true,
      depthTest: false,
    })
  );
  line.renderOrder = 999;
  line.raycast = () => {};
  line.userData.isHoverOverlay = true;
  return line;
}
