import { Raycaster, Vector2, Vector3 } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import { isWorldPointVisible } from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { getSolidMeshesFromObject3D } from "Features/threedEditor/js/utilsAnnotationsManager/getSolidMeshFromObject3D";

// Slack (m) of the "is this edge point hidden behind a face" test: the faces
// the edge belongs to are hit at the very same distance.
const OCCLUSION_TOL_M = 0.02;

// The edge lines of a mesh annotation object (buildMesh3dAnnotationObject):
// LineSegments carrying EVERY mesh edge — userData.mesh3dEdges[i] (vertex
// pair) with its 6 local coordinates at userData.mesh3dEdgePositions[6 * i].
// The drawn geometry is only a subset (facet seams are hidden by the
// "Wireframe" crease threshold): never index it by edge.
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
  const positions = lines?.userData?.mesh3dEdgePositions;
  if (!positions) return [];
  lines.updateWorldMatrix(true, false);
  return lines.userData.mesh3dEdges.map(([a, b], i) => ({
    a,
    b,
    pa: new Vector3()
      .fromArray(positions, 6 * i)
      .applyMatrix4(lines.matrixWorld),
    pb: new Vector3()
      .fromArray(positions, 6 * i + 3)
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
  // Occluders: the displayed faces only — a face hidden with « Masquer
  // l'annotation » (invisible mesh) hides nothing.
  const faces = [];
  annoObject?.traverse?.((child) => {
    if (
      child.isMesh &&
      child.visible &&
      child.userData?.mesh3dFaceIndex !== undefined
    ) {
      faces.push(child);
    }
  });
  return pickEdgeAmong({
    edges: getMesh3dEdgesWorld(annoObject),
    occluders: faces,
    cursor,
    camera,
    rect,
    thresholdPx,
    clippingPlane,
  });
}

// Same pick on the DISPLAYED conversion of a regular annotation (or of a mesh
// one carved live): getDisplayedMesh3d's result, whose edges are not drawn as
// pickable lines. The annotation's solid meshes are the occluders.
export function pickDisplayedMesh3dEdge(
  displayed,
  cursor,
  camera,
  rect,
  thresholdPx = 8,
  clippingPlane = null
) {
  const { mesh, baseMapGroup, object } = displayed ?? {};
  if (!mesh || !baseMapGroup) return null;
  baseMapGroup.updateWorldMatrix(true, false);
  const lift = displayed.baseOffsetZ ?? 0;
  const toWorld = (v) =>
    baseMapGroup.localToWorld(new Vector3(v.x, v.y, v.z + lift));
  const edges = [];
  const seen = new Set();
  for (const face of mesh.faces) {
    for (const loop of [face.loop, ...(face.holes || [])]) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
          a,
          b,
          pa: toWorld(mesh.vertices[a]),
          pb: toWorld(mesh.vertices[b]),
        });
      }
    }
  }
  return pickEdgeAmong({
    edges,
    occluders: object ? getSolidMeshesFromObject3D(object) : [],
    cursor,
    camera,
    rect,
    thresholdPx,
    clippingPlane,
  });
}

function pickEdgeAmong({
  edges,
  occluders,
  cursor,
  camera,
  rect,
  thresholdPx,
  clippingPlane,
}) {
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

  const raycaster = new Raycaster();
  const origin = camera.getWorldPosition(new Vector3());

  for (const { edge, point } of candidates) {
    if (!isWorldPointVisible(clippingPlane, point)) continue;
    const toPoint = point.clone().sub(origin);
    const pointDistance = toPoint.length();
    if (pointDistance < 1e-6) continue;
    raycaster.set(origin, toPoint.normalize());
    const hit = raycaster.intersectObjects(occluders, false)[0];
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

// Thick screen-space lines over mesh edges — the hover / selection feedback.
// Depth-tested: an edge hidden by the surrounding geometry stays hidden. The
// polygon offset pulls the line in front of the faces it lies on (it would
// z-fight with them otherwise). Invisible to raycasts and to the snap index.
// The caller adds the line to the scene and disposes geometry + material.
//
// positions: flat world xyz pairs [ax, ay, az, bx, by, bz, …].
export function buildMesh3dEdgeLines(
  positions,
  { color, linewidth, domElement }
) {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const line = new LineSegments2(
    geometry,
    new LineMaterial({
      color,
      linewidth,
      resolution: new Vector2(
        domElement?.clientWidth || 1,
        domElement?.clientHeight || 1
      ),
      worldUnits: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    })
  );
  line.renderOrder = 999;
  line.raycast = () => {};
  line.userData.isHoverOverlay = true;
  return line;
}
