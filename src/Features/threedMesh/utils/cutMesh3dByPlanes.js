import cutFacesByPlanes from "./cutFacesByPlanes.js";
import cutShellByPlanes from "./cutShellByPlanes.js";

// Cuts a maille — whatever its model — by 1 or 2 world half-spaces, and
// returns both sides ready to be previewed (areas, centroids, red line) and
// committed (splitMesh3dByWedgeService).
//
// One plane = a plain plane cut (the reference-plane preview of the angular
// tool); two planes = the angular wedge.
export default function cutMesh3dByPlanes({ mesh3d, planes }) {
  if (!mesh3d || !planes?.length) return null;
  if (mesh3d.shell?.positions?.length) {
    return cutShellByPlanes({ positions: mesh3d.shell.positions, planes });
  }
  return cutFacesByPlanes({ faces: mesh3d.faces, planes });
}
