import {
  Shape,
  Path,
  ShapeGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Group,
  LineSegments,
  LineBasicMaterial,
  DoubleSide,
} from "three";

import getGuideLineStairsLayout, {
  findStairsGuideLine,
} from "Features/annotations/utils/getGuideLineStairsLayout";

import pixelToWorld from "./pixelToWorld";

// Lift surfaces slightly above the basemap plane / treads to avoid z-fighting
// (same convention as extrudeClosedShape's Z_FIGHT_OFFSET and the strip fold
// lines' STRIP_FOLD_LINE_LIFT).
const Z_FIGHT_OFFSET = 0.001;
const NOSING_LINE_LIFT = 0.004;

// Build a stepped stairs surface (treads + risers, no volume) for a POLYGON
// annotation whose guideLine is flagged `isStairs`. Each tread is the polygon
// clipped to its band along the guide line, placed flat at its tread height;
// each nosing gets a vertical riser face. Like the ramp nappe, the result is
// a SURFACE: annotation.height is ignored (v1).
//
// Returns a Group (meshes tagged role: "SOLID") or null when the layout is
// degenerate (caller falls back to the flat extrusion).
export default function buildStairsFromGuideLine({
  annotation,
  baseMap,
  material,
  verticalLift = 0,
}) {
  const guideLine = findStairsGuideLine(annotation?.guideLines);
  if (!guideLine) return null;

  const layout = getGuideLineStairsLayout({
    guideLine,
    polygonPts: annotation.points || [],
    cuts: (annotation.cuts || []).map((c) => c?.points || []),
    meterByPx: baseMap.meterByPx,
  });
  if (!layout) return null;

  const toLocal = (p) => pixelToWorld(p, baseMap);

  // Surface material: both faces must read with the SAME color, so drop the
  // back-face darkening baked in for closed shells (same pattern as the ramp
  // nappe / buildSlopedStripGroup).
  const surfaceMaterial = material.clone();
  surfaceMaterial.side = DoubleSide;
  surfaceMaterial.onBeforeCompile = () => {};
  surfaceMaterial.customProgramCacheKey = () =>
    "annotationStairsSurfaceNoDarken";
  surfaceMaterial.needsUpdate = true;

  const group = new Group();

  // --- Treads (+ leading floor band at z = 0) ---
  // polygon-clipping rings repeat the first vertex at the end — drop it.
  const ringToLocal = (ring) => {
    const pts = ring.map(([x, y]) => toLocal({ x, y }));
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (
      pts.length > 1 &&
      Math.abs(first.x - last.x) < 1e-9 &&
      Math.abs(first.y - last.y) < 1e-9
    ) {
      pts.pop();
    }
    return pts;
  };

  layout.bands.forEach((band, k) => {
    const polys = layout.bandPolysAt(k);
    const z = verticalLift + band.z + Z_FIGHT_OFFSET;
    polys.forEach((poly) => {
      const [outer, ...holes] = poly;
      const outerPts = ringToLocal(outer || []);
      if (outerPts.length < 3) return;
      const shape = new Shape();
      shape.moveTo(outerPts[0].x, outerPts[0].y);
      outerPts.slice(1).forEach((p) => shape.lineTo(p.x, p.y));
      shape.closePath();
      holes.forEach((holeRing) => {
        const holePts = ringToLocal(holeRing || []);
        if (holePts.length < 3) return;
        const path = new Path();
        path.moveTo(holePts[0].x, holePts[0].y);
        holePts.slice(1).forEach((p) => path.lineTo(p.x, p.y));
        path.closePath();
        shape.holes.push(path);
      });
      const geometry = new ShapeGeometry(shape);
      geometry.translate(0, 0, z);
      const mesh = new Mesh(geometry, surfaceMaterial);
      // Tag the solid so the CSG / subtraction pipeline can locate it.
      mesh.userData = { role: "SOLID" };
      group.add(mesh);
    });
  });

  // --- Risers (vertical quads at each nosing) + nosing edge overlay ---
  if (layout.riserH > 0) {
    const positions = [];
    const indices = [];
    const nosingLine = [];
    layout.nosings.forEach((nosing) => {
      const zLow = verticalLift + nosing.zLow + Z_FIGHT_OFFSET;
      const zHigh = verticalLift + nosing.zHigh + Z_FIGHT_OFFSET;
      nosing.segments.forEach((seg) => {
        const a = toLocal(seg.a);
        const b = toLocal(seg.b);
        const base = positions.length / 3;
        positions.push(
          a.x,
          a.y,
          zLow,
          b.x,
          b.y,
          zLow,
          b.x,
          b.y,
          zHigh,
          a.x,
          a.y,
          zHigh
        );
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        nosingLine.push(
          a.x,
          a.y,
          zHigh + NOSING_LINE_LIFT,
          b.x,
          b.y,
          zHigh + NOSING_LINE_LIFT
        );
      });
    });
    if (positions.length > 0) {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3)
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const risersMesh = new Mesh(geometry, surfaceMaterial);
      risersMesh.userData = { role: "SOLID" };
      group.add(risersMesh);

      // White nosing edges (same styling as the strip fold lines) so the
      // steps stay legible from above.
      const lineGeometry = new BufferGeometry();
      lineGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(nosingLine, 3)
      );
      group.add(
        new LineSegments(
          lineGeometry,
          new LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
          })
        )
      );
    }
  }

  if (group.children.length === 0) return null;
  return group;
}
