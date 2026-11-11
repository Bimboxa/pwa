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

import getMesh3dEdgeFolds from "Features/annotationMesh3d/utils/getMesh3dEdgeFolds";
import isMesh3dClosed from "Features/annotationMesh3d/utils/isMesh3dClosed";
import { getFace2d } from "Features/annotationMesh3d/utils/mesh3dFace2d";
import { mesh3dToLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
import splitTJunctions from "Features/geometry/utils/splitTJunctions";
import { getHiddenMesh3dFaceIndices } from "Features/hiddenAnnotations/utils/mesh3dFaceSignature";
import applyMesh3dEdgeThreshold from "./applyMesh3dEdgeThreshold";
import getAnnotationVerticalLift from "./getAnnotationVerticalLift";
import {
  getFaceArea,
  getFaceLoops,
  getFaceNormal,
} from "Features/annotationMesh3d/utils/mesh3dTopology";

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
export function buildMesh3dFaceGeometry(vertices, face, lift) {
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
  // Holes aligned with each other leave earcut T-junctions (see the util).
  return holes2d.length ? splitTJunctions(geometry) : geometry;
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
// reason (a dihedral threshold would hide the coplanar splits). The facet
// seams of a curved sheet (a fold above coplanar, up to the "Wireframe"
// crease threshold) are not drawn — they stay pickable edges.
//
// The group carries `mesh3dClosed` (the stored faces bound a volume): the
// CSG reads it to carve a sheet host hollow and to refuse an open cutter.
// A live subtraction (subtractAnnotationGeometries) collapses the face
// meshes into ONE carved `hasSubtraction` mesh, no `mesh3dFaceIndex` left:
// its faces are then those of the carved solid (getDisplayedMesh3d),
// selectable but never written — « Soustraire définitivement » is the way
// back to an editable mesh.
//
// Faces hidden with « Masquer l'annotation » (`annotation._hiddenMesh3dFaces`,
// face signatures — useAutoLoadAnnotationsInThreedEditor tags the copy): the
// face mesh is still built, so the face indices and the closed volume read by
// the CSG are unchanged, but it is INVISIBLE (`mesh3dFaceHidden`) — the picks
// (filterIntersectionsByVisibility), the snap index and the lasso skip
// invisible objects. An edge is drawn only when a visible face carries it.
// A live subtraction collapses every face, the hidden ones included: a carved
// host shows them again.
//
// `userData.isMesh3d` is NOT used here: it tags the mailles (ThreedMeshes).
export default function buildMesh3dAnnotationObject(
  annotation,
  baseMap,
  material,
  options
) {
  const mesh = mesh3dToLocal(annotation?.mesh3d, baseMap);
  if (!mesh.vertices.length || !mesh.faces.length) return null;

  const lift = getAnnotationVerticalLift(annotation, options);
  const group = new Group();

  // A sheet has no thickness: it must read from both sides, like the flat
  // polygons of extrudeClosedShape.
  material.side = DoubleSide;

  // Stored face indices hidden for the session (same numbering as the local
  // mesh: mesh3dToLocal keeps the faces in order).
  const hiddenFaceIndices = getHiddenMesh3dFaceIndices(
    annotation,
    annotation._hiddenMesh3dFaces
  );

  mesh.faces.forEach((face, faceIndex) => {
    if (face.loop.length < 3) return;
    const geometry = buildMesh3dFaceGeometry(mesh.vertices, face, lift);
    if (!geometry) return;
    const faceMesh = new Mesh(geometry, material);
    // mesh3dFaceInfo: measures of the face (m², m), shown by the hover
    // tooltip — the geometry is metric, no need to go back to the row.
    // mesh3dFaceEdges: its edges as vertex pairs (contour + holes), for the
    // "face + its edges" selection.
    faceMesh.userData = {
      role: "SOLID",
      mesh3dFaceIndex: faceIndex,
      mesh3dFaceEdges: getFaceLoops(face).flatMap((loop) =>
        loop.map((vi, i) => [vi, loop[(i + 1) % loop.length]])
      ),
      mesh3dFaceInfo: {
        surface: getFaceArea(mesh.vertices, face),
        length: getFacePerimeter(mesh.vertices, face),
      },
    };
    if (hiddenFaceIndices.has(faceIndex)) {
      faceMesh.visible = false;
      faceMesh.userData.mesh3dFaceHidden = true;
    }
    group.add(faceMesh);
  });
  if (!group.children.length) return null;

  // Edges of the visible faces only: an edge shared with a visible face is
  // still carried by that face (and reads as its border).
  const segments = [];
  const edgeVertices = []; // [a, b] vertex indices, one per edge
  const edgeFolds = []; // fold (deg) between its two faces, null = border
  for (const { a, b, foldDeg } of getMesh3dEdgeFolds(mesh, {
    skipFaceIndices: hiddenFaceIndices,
  })) {
    const p = mesh.vertices[a];
    const q = mesh.vertices[b];
    segments.push(p.x, p.y, p.z + lift, q.x, q.y, q.z + lift);
    edgeVertices.push([a, b]);
    edgeFolds.push(foldDeg);
  }
  const edges = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
  );
  // mesh3dEdges / mesh3dEdgePositions: EVERY edge of the mesh (vertex pair +
  // its 6 local coordinates), for the edge pick / highlight (pickMesh3dEdge)
  // — plain arrays, they survive a userData clone (block instances).
  // mesh3dEdgeFolds: what the "Wireframe" crease threshold hides among them
  // (the facet seams of a curved sheet — applyMesh3dEdgeThreshold, re-applied
  // by applyWireframeSettings); the drawn geometry is that subset.
  edges.userData = {
    isGridEdge: true,
    gridEdgeKind: "MESH3D",
    mesh3dEdges: edgeVertices,
    mesh3dEdgePositions: segments,
    mesh3dEdgeFolds: edgeFolds,
  };
  applyMesh3dEdgeThreshold(edges, options?.gridEdgeThresholdDeg ?? 1);
  edges.raycast = () => {};
  group.add(edges);

  group.userData = {
    isAnnotationMesh3d: true,
    mesh3dLift: lift,
    mesh3dClosed: isMesh3dClosed(mesh),
  };
  return group;
}
