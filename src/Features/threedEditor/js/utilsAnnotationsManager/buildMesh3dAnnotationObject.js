import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  ShapeUtils,
  Vector2,
} from "three";

import { getFace2d } from "Features/annotationMesh3d/utils/mesh3dFace2d";
import { mesh3dToLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
import {
  getFaceArea,
  getFaceLoops,
  getFaceNormal,
} from "Features/annotationMesh3d/utils/mesh3dTopology";

// Same 1 mm lift as extrudeClosedShape: keeps the mesh off the base map image
// plane, and keeps its vertices in the same snap buckets as its neighbors.
export const MESH3D_Z_FIGHT_OFFSET = 0.001;

function signedTriangleArea(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
}

// Total length of the edges of a face (contour + holes).
function getFacePerimeter(vertices, face) {
  let sum = 0;
  for (const loop of getFaceLoops(face)) {
    for (let i = 0; i < loop.length; i++) {
      const p = vertices[loop[i]];
      const q = vertices[loop[(i + 1) % loop.length]];
      sum += Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
    }
  }
  return sum;
}

// One planar face -> BufferGeometry, triangulated in the face plane and
// wound counter-clockwise around the outward normal (the annotation material
// darkens back faces).
function buildFaceGeometry(vertices, face, lift) {
  const face2d = getFace2d(vertices, face);
  const [contour2d, ...holes2d] = face2d.loops.map((loop) =>
    loop.map((p) => new Vector2(p.x, p.y))
  );
  const flat = [contour2d, ...holes2d].flat();
  const indices = getFaceLoops(face).flat();
  const triangles = ShapeUtils.triangulateShape(contour2d, holes2d);
  if (!triangles.length) return null;

  const normal = getFaceNormal(vertices, face);
  const positions = [];
  const normals = [];
  for (const [ia, ib, ic] of triangles) {
    const ccw = signedTriangleArea(flat[ia], flat[ib], flat[ic]) >= 0;
    for (const i of ccw ? [ia, ib, ic] : [ia, ic, ib]) {
      const v = vertices[indices[i]];
      positions.push(v.x, v.y, v.z + lift);
      normals.push(normal.x, normal.y, normal.z);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  return geometry;
}

// The 3D object of an `isMesh3d` annotation: its stored polygon faces
// (annotation.mesh3d, see mesh3dFrame), in base-map-local meters.
//
// ONE Mesh PER FACE, on purpose:
// - two coplanar faces split by a drawn line keep their common edge as a
//   border of each mesh, so it stays a snappable feature edge (the snap index
//   drops the edges between coplanar triangles of a same mesh);
// - the hover stipple and the push/pull pick address a face directly through
//   `userData.mesh3dFaceIndex`.
// Edge lines come from the face loops, not from EdgesGeometry, for the same
// reason (a dihedral threshold would hide the coplanar splits).
//
// `userData.isMesh3d` is NOT used here: it tags the mailles (ThreedMeshes).
export default function buildMesh3dAnnotationObject(
  annotation,
  baseMap,
  material
) {
  const mesh = mesh3dToLocal(annotation?.mesh3d, baseMap);
  if (!mesh.vertices.length || !mesh.faces.length) return null;

  const lift = (Number(annotation.offsetZ) || 0) + MESH3D_Z_FIGHT_OFFSET;
  const group = new Group();

  // A sheet has no thickness: it must read from both sides, like the flat
  // polygons of extrudeClosedShape.
  material.side = DoubleSide;

  mesh.faces.forEach((face, faceIndex) => {
    if (face.loop.length < 3) return;
    const geometry = buildFaceGeometry(mesh.vertices, face, lift);
    if (!geometry) return;
    const faceMesh = new Mesh(geometry, material);
    // mesh3dFaceInfo: measures of the face (m², m), shown by the hover
    // tooltip — the geometry is metric, no need to go back to the row.
    faceMesh.userData = {
      role: "SOLID",
      mesh3dFaceIndex: faceIndex,
      mesh3dFaceInfo: {
        surface: getFaceArea(mesh.vertices, face),
        length: getFacePerimeter(mesh.vertices, face),
      },
    };
    group.add(faceMesh);
  });
  if (!group.children.length) return null;

  const segments = [];
  const edgeVertices = []; // [a, b] vertex indices, one per drawn segment
  const seen = new Set();
  for (const face of mesh.faces) {
    for (const loop of getFaceLoops(face)) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const p = mesh.vertices[a];
        const q = mesh.vertices[b];
        segments.push(p.x, p.y, p.z + lift, q.x, q.y, q.z + lift);
        edgeVertices.push([a, b]);
      }
    }
  }
  const edgesGeometry = new BufferGeometry();
  edgesGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(segments, 3)
  );
  const edges = new LineSegments(
    edgesGeometry,
    new LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
  );
  // mesh3dEdges: lets the edge pick / highlight map a drawn segment back to
  // the mesh edge (see pickMesh3dPart).
  edges.userData = {
    isGridEdge: true,
    gridEdgeKind: "MESH3D",
    mesh3dEdges: edgeVertices,
  };
  edges.raycast = () => {};
  group.add(edges);

  group.userData = { isAnnotationMesh3d: true, mesh3dLift: lift };
  return group;
}
