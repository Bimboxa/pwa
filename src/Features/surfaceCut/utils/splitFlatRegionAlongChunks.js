import { splitMesh3dFaceDetailed } from "../../annotationMesh3d/utils/splitMesh3dFace.js";
import { getFaceLoops } from "../../annotationMesh3d/utils/mesh3dTopology.js";

import { signedArea2d } from "./getPathChunksInRegion.js";

// Cuts a flat 2D region (a contour and its holes) along the chunks of a path
// (getPathChunksInRegion): the region becomes a one-face sheet and each chunk
// is drawn on it with the mesh face splitter, which keeps every original
// vertex at its index, inserts the cut ends on the edges and handles the
// holes (a chunk joining the contour to a hole merges them, the next chunk
// back to the contour cuts the region).
//
// loops: [contour, ...holes], open loops [{x, y}]; chunks: [[{x, y}]].
// Returns { vertices, faces } — vertices [{x, y}]: indices 0..n-1 are the
// loops' vertices in order (contour first), new vertices follow; faces
// [{ loop, holes }] wound like the contour (holes the other way) — or null
// when the chunks do not cut the region in two or more pieces (a chunk could
// not be drawn, or a piece keeps a slit: a contour → hole run not closed by
// another one).
export default function splitFlatRegionAlongChunks(loops, chunks) {
  if (!loops?.[0] || loops[0].length < 3 || !chunks?.length) return null;

  const vertices = [];
  const indexLoops = loops.map((loop) =>
    loop.map((p) => {
      vertices.push({ x: p.x, y: p.y, z: 0 });
      return vertices.length - 1;
    })
  );
  // The splitter expects the holes wound against the contour.
  const contourSign = Math.sign(signedArea2d(loops[0]));
  const [contour, ...holes] = indexLoops.map((indices, i) =>
    i > 0 && Math.sign(signedArea2d(loops[i])) === contourSign
      ? [...indices].reverse()
      : indices
  );

  let mesh = { vertices, faces: [{ loop: contour, holes }] };
  for (const chunk of chunks) {
    const split = splitMesh3dFaceDetailed(
      mesh,
      chunk.map((p) => ({ x: p.x, y: p.y, z: 0 }))
    );
    if (!split) return null;
    mesh = split.mesh;
  }
  if (mesh.faces.length < 2 || mesh.faces.some(hasSlit)) return null;

  return {
    vertices: mesh.vertices.map((v) => ({ x: v.x, y: v.y })),
    faces: mesh.faces,
  };
}

// A face walking an edge both ways: a path bridging two of its loops that no
// other path closed.
function hasSlit(face) {
  const edges = new Set();
  for (const loop of getFaceLoops(face)) {
    for (let i = 0; i < loop.length; i++) {
      edges.add(`${loop[i]}_${loop[(i + 1) % loop.length]}`);
    }
  }
  for (const key of edges) {
    const [a, b] = key.split("_");
    if (edges.has(`${b}_${a}`)) return true;
  }
  return false;
}
