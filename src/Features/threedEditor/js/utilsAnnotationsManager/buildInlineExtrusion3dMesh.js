import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  DoubleSide,
} from "three";

import {
  buildSweepArrays3d,
  computeSegmentFrames3d,
  getSweep3dSetup,
} from "./sweepGeometry3d";
import buildGridEdgeLines from "./buildGridEdgeLines";

// 3D sibling of buildInlineExtrusionMesh for a guide that climbs (per-vertex
// offsetBottom): the chain is swept as a true 3D polyline and the inline
// profile as a planar 3D section (see sweepGeometry3d.js). Inputs are in
// basemap-local units with z already lifted (offsetZ + offsets / heights).
export default function buildInlineExtrusion3dMesh({
  guidePointsLocal3d,
  profilePointsLocal3d,
  material,
  hiddenSegmentsIdx = [],
  closeLine = false,
  gridEdgeThresholdDeg = 1,
}) {
  const hidden = new Set(hiddenSegmentsIdx ?? []);
  const setup = getSweep3dSetup({
    guidePoints: guidePointsLocal3d,
    profilePoints: profilePointsLocal3d,
    hidden,
    closeLine,
  });
  if (!setup) return null;
  const frames = computeSegmentFrames3d(
    guidePointsLocal3d,
    hidden,
    closeLine,
    setup.segIndex,
    setup.frame
  );
  const arrays = buildSweepArrays3d(
    guidePointsLocal3d,
    frames,
    hidden,
    setup.section,
    closeLine
  );
  if (!arrays) return null;

  const geom = new BufferGeometry();
  geom.setAttribute(
    "position",
    new Float32BufferAttribute(arrays.positions, 3)
  );
  geom.setIndex(arrays.indices);
  geom.computeVertexNormals();

  const group = new Group();
  // Marks the object as the swept inline surface (not the plain wall
  // createAnnotationObject3D falls back to when the setup is degenerate):
  // the permanent subtraction bake refuses to freeze a fallback wall in
  // the sheet's place.
  group.userData = { ...(group.userData ?? {}), inlineExtrusion: true };
  const surfMat = material.clone();
  surfMat.side = DoubleSide;
  const mesh = new Mesh(geom, surfMat);
  mesh.userData = { ...(mesh.userData ?? {}), role: "SOLID" };
  group.add(mesh);
  group.add(
    buildGridEdgeLines(geom, {
      thresholdDeg: gridEdgeThresholdDeg,
      sourceMesh: mesh,
    })
  );
  return group;
}
