import { Matrix4, Plane, Vector3 } from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import computePlaneSectionSegments from "Features/threedEditor/js/utilsClipping/computePlaneSectionSegments";
import { SECTION_MARKER_LIFT } from "./buildRevolutionMesh";

// Distance (m) the section plane is pushed INSIDE the kept sweep before
// sectioning: exactly at the boundary the plane only grazes the open shell's
// edge (measure-zero intersection); slightly inside it crosses real triangles
// and yields the profile trace — with gaps wherever a carved opening is
// intercepted. The displayed line is shifted back outward by the same amount
// (+ the usual lift), so it still sits at the boundary.
const SECTION_PLANE_INSET = 0.005;

// After a subtraction carve of a partial REVOLUTION, the analytic profile
// boundary lines built by buildRevolutionMesh may float over carved openings.
// This pass replaces each boundary line's geometry by the plane-section of the
// CARVED solid mesh at its stored boundary plane (see line.userData
// .sectionBoundary), so intercepted openings interrupt the ink trace.
// No-op on objects without section markers. Must run after the parent chain's
// matrixWorld is up to date (the carve block does updateMatrixWorld(true)).
export default function refreshRevolutionSectionMarkers(rootObject) {
  if (!rootObject) return;

  const jobs = [];
  rootObject.traverse?.((child) => {
    if (child.isMesh && child.userData?.role === "SOLID") {
      child.children?.forEach((line) => {
        if (line.userData?.isSectionMarker && line.userData?.sectionBoundary) {
          jobs.push({ mesh: child, line });
        }
      });
    }
  });
  if (jobs.length === 0) return;

  const invMatrix = new Matrix4();
  for (const { mesh, line } of jobs) {
    const { phi, outwardSign, axisAlongNormal, center } =
      line.userData.sectionBoundary;

    // Sweep tangent at the boundary, in the lathe's pre-rotation frame, then
    // through the same rotateX(π/2) applied to the geometry when the axis is
    // along the base map normal ((x, y, z) → (x, −z, y)).
    const toFrame = (x, y, z) =>
      axisAlongNormal ? new Vector3(x, -z, y) : new Vector3(x, y, z);
    const tangent = toFrame(Math.cos(phi), 0, -Math.sin(phi));
    // `center` is applied AFTER the rotation in the geometry pipeline
    // (geom.rotateX then geom.translate), so it is already in mesh frame.
    const centerLocal = new Vector3(center.x, center.y, center.z);

    // Boundary plane in mesh-local frame, inset toward the kept sweep, then
    // mapped to world (computePlaneSectionSegments reads world space).
    mesh.updateWorldMatrix(true, false);
    const pointLocal = centerLocal
      .clone()
      .addScaledVector(tangent, -outwardSign * SECTION_PLANE_INSET);
    const pointWorld = pointLocal.clone().applyMatrix4(mesh.matrixWorld);
    const normalWorld = tangent.clone().transformDirection(mesh.matrixWorld);
    const plane = new Plane().setFromNormalAndCoplanarPoint(
      normalWorld,
      pointWorld
    );

    const { positions } = computePlaneSectionSegments(plane, [mesh]);
    if (!positions.length) continue; // keep the analytic line as fallback

    // World → line-local (the line is a child of the mesh), then shift back
    // outward past the boundary so the trace sits lifted like the original.
    invMatrix.copy(mesh.matrixWorld).invert();
    const backShift = tangent
      .clone()
      .multiplyScalar(
        outwardSign * (SECTION_PLANE_INSET + SECTION_MARKER_LIFT)
      );
    const local = new Array(positions.length);
    const v = new Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      v.set(positions[i], positions[i + 1], positions[i + 2])
        .applyMatrix4(invMatrix)
        .add(backShift);
      local[i] = v.x;
      local[i + 1] = v.y;
      local[i + 2] = v.z;
    }

    const geom = new LineSegmentsGeometry();
    geom.setPositions(local);
    line.geometry.dispose();
    line.geometry = geom;
    line.computeLineDistances();
  }
}
