import computePlaneBasis from "./computePlaneBasis.js";
import extractBoundaryLoops3d from "./extractBoundaryLoops3d.js";
import { projectLoopTo2d } from "./planeProjection.js";
import { signedArea2d } from "./computeFaceArea.js";

// Boundary extraction for a PLANAR triangle region (a planar region of
// faceHoverHighlight.getFaceRegion): the 3D boundary loops
// (extractBoundaryLoops3d) classified as one outer contour + inner holes in
// the region plane.
//
// Pure (no three.js): operates on plain position arrays in mesh-LOCAL
// coordinates, so it is directly replayable from node scripts. Callers apply
// matrixWorld themselves (see buildMeshDataFromRegion.js).

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat xyz array (Float32Array ok)
 * @param {ArrayLike<number>|null} args.index - triangle index, or null (soup)
 * @param {number[]} args.tris - triangle indices of the coplanar region
 * @returns {{contour: [{x,y,z}], holes: [[{x,y,z}]], normal: {x,y,z}} | null}
 *   Loops are open (no closing duplicate), contour CCW / holes CW in the
 *   plane basis of `normal`. Local coordinates.
 */
export default function extractRegionBoundaryLoops({ positions, index, tris }) {
  const boundary = extractBoundaryLoops3d({ positions, index, tris });
  if (!boundary) return null;
  const { loops, normal } = boundary;

  // Classification in the plane basis: the largest |area| loop is the
  // contour, the others are holes.
  const basis = computePlaneBasis(normal, loops[0][0]);
  const measured = loops.map((loop) => ({
    loop,
    signedArea: signedArea2d(projectLoopTo2d(loop, basis)),
  }));
  measured.sort((m1, m2) => Math.abs(m2.signedArea) - Math.abs(m1.signedArea));

  const [outer, ...inner] = measured;
  return {
    // Contour CCW (positive area in the basis), holes CW.
    contour: outer.signedArea < 0 ? [...outer.loop].reverse() : outer.loop,
    holes: inner
      .filter((m) => Math.abs(m.signedArea) > 0)
      .map((m) => (m.signedArea > 0 ? [...m.loop].reverse() : m.loop)),
    normal,
  };
}
