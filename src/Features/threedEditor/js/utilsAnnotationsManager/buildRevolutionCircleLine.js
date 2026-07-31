import { Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { SEGMENTS_PER_FULL_CIRCLE } from "Features/geometry/utils/arcSampling";

import { boundaryVertex } from "./buildRevolutionMesh";
import attachFatLineRaycast from "./attachFatLineRaycast";

// Circle traced by a POINT annotation revolved around a referenced
// REVOLUTION_AXIS — the point-shaped counterpart of buildRevolutionMesh (which
// revolves an arc into a lathe SURFACE). A single point has no cross-section to
// sweep, so it produces a LINE, not a surface: no volume, no area, and it never
// takes part in CSG subtractions.
//
// Geometry model — identical to buildRevolutionMesh so a circle and a lathe
// sharing the same axis stay coherent:
//   - radius = |point.x − axisX|   (in-plane distance to the drawn axis)
//   - height = point.y  − baseY    (above the axis bottom, shared across every
//                                   element revolved around that same axis)
//   - the revolution axis is the base map NORMAL; boundaryVertex applies the
//     matching frame ops, then the translation to `center`.
//
// `centerLocal` is the in-plane position of the axis, taken from the linked
// REVOLUTION_POINT (resolved by useAnnotationsV2). When null (no point), the
// circle sits at the drawn axis's own location.
//
// Caller must pass point/axis points already in basemap-local metres.

// Screen-space thickness (px) — matches the POINT vertical trait so the two 3D
// representations of a POINT annotation read the same weight.
const LINEWIDTH_PX = 3;

// Below this radius the circle degenerates to a dot: skip it (the caller then
// falls back to the default POINT rendering).
const MIN_RADIUS_M = 1e-4;

export default function buildRevolutionCircleLine({
  pointLocal,
  axisPoints,
  centerLocal = null,
  orientation = "HORIZONTAL",
  material,
  phiStart = 0,
  phiLength = Math.PI * 2,
  resolution = null,
}) {
  if (!pointLocal) return null;
  if (!axisPoints || axisPoints.length < 2) return null;

  // Vertical-in-drawing axis position: average local x of the axis line.
  const axisX = axisPoints.reduce((sum, p) => sum + p.x, 0) / axisPoints.length;

  // Shared vertical reference = the axis line's bottom, so a circle keeps its
  // relative height against the other elements revolved around the same axis.
  const baseY = Math.min(...axisPoints.map((p) => p.y));

  const radius = Math.abs(pointLocal.x - axisX);
  if (!(radius > MIN_RADIUS_M)) return null;
  const height = pointLocal.y - baseY;

  const axisAlongNormal = orientation !== "VERTICAL";

  // In-plane placement of the axis. With a linked point, use it; otherwise fall
  // back to the drawn axis's own location.
  let center;
  if (centerLocal) {
    center = { x: centerLocal.x, y: centerLocal.y, z: centerLocal.z ?? 0 };
  } else if (axisAlongNormal) {
    const avgAxisY =
      axisPoints.reduce((sum, p) => sum + p.y, 0) / axisPoints.length;
    center = { x: axisX, y: avgAxisY, z: 0 };
  } else {
    center = { x: axisX, y: baseY, z: 0 };
  }

  // 24 segments per full turn, scaled down on a partial sweep. The constant is
  // the shared mesh↔quantities discretization contract (arcSampling.js).
  const turnFraction = Math.min(1, Math.max(0, phiLength / (Math.PI * 2)));
  const segments = Math.max(
    2,
    Math.round(SEGMENTS_PER_FULL_CIRCLE * turnFraction)
  );

  // segments + 1 samples: on a full turn the last one lands back on the first,
  // so the ring closes as an open POLYLINE. Deliberate — the OBJ exporter
  // handles Line and LineSegments but NOT LineLoop (it would emit orphan `v`
  // entries with no `l` element).
  const positions = [];
  const localPoints = [];
  for (let i = 0; i <= segments; i++) {
    const phi = phiStart + (phiLength * i) / segments;
    const [x, y, z] = boundaryVertex(
      radius,
      height,
      phi,
      0, // no outward lift: the circle is not a section marker
      axisAlongNormal,
      center
    );
    positions.push(x, y, z);
    localPoints.push(new Vector3(x, y, z));
  }

  const geom = new LineGeometry();
  geom.setPositions(positions);
  // Per-call material (NEVER a module singleton): deleting an annotation
  // disposes its materials.
  const lineMat = new LineMaterial({
    // Color.set() copies the components, so the source material is untouched.
    // Going through makeMaterial's material (rather than the raw annotation
    // color) keeps the circle consistent with the active render mode.
    color: material?.color ?? 0xcccccc,
    linewidth: LINEWIDTH_PX,
    worldUnits: false, // screen-space px thickness
    transparent: true,
    // Respect the depth buffer so the circle is occluded by walls standing in
    // front of it (same rule as the POINT trait).
    depthTest: true,
  });
  // Assigned AFTER construction and only when present: the `resolution` setter
  // copies into a Vector2, so passing a null through setValues throws. Headless
  // build paths (carve / quantities) call in without a resolution.
  if (resolution) lineMat.resolution.copy(resolution);
  const line = new Line2(geom, lineMat);
  line.computeLineDistances();
  attachFatLineRaycast(line, localPoints);
  // Line2 is an `isMesh` holding INSTANCED geometry: it would export as broken
  // triangles. buildExportScene reads this tag and emits a plain THREE.Line
  // rebuilt from these positions instead — that is what SketchUp reads as a
  // polyline.
  line.userData.exportLine = { positions };
  return line;
}
