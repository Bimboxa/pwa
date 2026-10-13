import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
} from "three";

import {
  getDiscSector,
  getDomeProfile,
} from "Features/annotations/utils/discGeometry";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import pixelToWorld from "./pixelToWorld";
import extrudeClosedShape from "./extrudeClosedShape";
import buildRevolutionSolidGeometry from "./buildRevolutionSolidGeometry";
import getRevolutionPhi from "./getRevolutionPhi";
import clipSoupByPlanHoles from "./clipSoupByPlanHoles";
import buildGridEdgeLines from "./buildGridEdgeLines";

// Samples per S-C-S arc of an opening when the dome is pierced in plan.
const HOLE_ARC_SAMPLES = 12;

// 3D object of a DISC annotation (centre + radiusM + optional sector), in
// basemap-local metres (the parent group lays the base map flat).
//
// - Default shape: the disc / sector extruded by `height` (flat sheet when
//   height is 0), through extrudeClosedShape with an S-C-S ring — the same
//   construction as a circle POLYGON.
// - « Coupole » (shape3D DISC_DOME): a revolution of a quarter ellipse
//   (R·cos t, H·sin t): vertical tangent at the rim, horizontal at the apex,
//   H = `height`. A FULL revolution is a watertight solid (closed toward the
//   axis: dome + flat base); a PARTIAL one is the open dome SURFACE only —
//   no section caps, no base. The lathe axis is the base map
//   normal: LatheGeometry revolves around +Y, so the geometry is turned with
//   rotateX(π/2) (lathe +Y → local +Z) and a lathe point at φ lands at the
//   plan angle ψ = φ − π/2 — hence getRevolutionPhi(start, end, 0) for a
//   partial sweep (same mapping as the axis-based revolutions).
const LATHE_SEGMENTS = 64;

// S-C-S ring of the disc / sector in local metres: the circle through 3
// points (square, circle, square) is what extrudeClosedShape's tracePath
// turns into an arc.
function buildDiscRing({ cx, cy, r, sector }) {
  const at = (phi, type) => ({
    x: cx + r * Math.cos(phi),
    y: cy + r * Math.sin(phi),
    type,
  });
  if (!sector.isSector) {
    return [
      at(0, "square"),
      at(Math.PI / 2, "circle"),
      at(Math.PI, "square"),
      at(Math.PI * 1.5, "circle"),
    ];
  }
  const mid = sector.start + sector.span / 2;
  return [
    { x: cx, y: cy, type: "square" },
    at(sector.start, "square"),
    at(mid, "circle"),
    at(sector.end, "square"),
  ];
}

function buildDome({
  cx,
  cy,
  r,
  height,
  sector,
  verticalLift,
  material,
  holes = [],
  gridEdgeThresholdDeg = 1,
}) {
  const profile = getDomeProfile(r, height).map((p) => new Vector2(p.r, p.h));
  const { phiStart, phiLength } = sector.isSector
    ? getRevolutionPhi(sector.start, sector.end, 0)
    : { phiStart: 0, phiLength: Math.PI * 2 };
  const turnFraction = Math.min(1, Math.max(0, phiLength / (Math.PI * 2)));
  const segments = Math.max(4, Math.round(LATHE_SEGMENTS * turnFraction));
  // Partial: open shell (the dome surface alone). Full: closed solid.
  let geom = sector.isSector
    ? new LatheGeometry(profile, segments, phiStart, phiLength)
    : buildRevolutionSolidGeometry({ profile, segments, phiStart, phiLength });
  if (!geom) return null;
  // Lathe +Y → local +Z (the base map normal), then place at the centre.
  geom.rotateX(Math.PI / 2);
  geom.translate(cx, cy, verticalLift);
  // Openings: the 2D cuts pierce the dome vertically (a lathe cannot carry
  // holes) — the soup is clipped in plan, triangle by triangle.
  if (holes.length) {
    const soup = geom.index ? geom.toNonIndexed() : geom;
    const positions = soup.getAttribute("position").array;
    const clipped = clipSoupByPlanHoles(
      positions,
      holes.map((h) => expandArcsInPath(h, HOLE_ARC_SAMPLES, true))
    );
    if (soup !== geom) soup.dispose();
    geom.dispose();
    geom = new BufferGeometry();
    geom.setAttribute("position", new Float32BufferAttribute(clipped, 3));
  }
  geom.computeVertexNormals();

  const surfMat = material.clone();
  surfMat.side = DoubleSide;
  const mesh = new Mesh(geom, surfMat);
  mesh.userData.role = "SOLID";
  mesh.userData.isRevolutionSolid = !sector.isSector;
  mesh.userData.revolutionAxis = {
    center: { x: cx, y: cy, z: verticalLift },
    axisAlongNormal: true,
  };

  const group = new Group();
  group.add(mesh);
  // Tagged (per-call material) so the carve pipeline can strip + rebuild the
  // grid from the carved geometry — see subtractAnnotationGeometries.
  group.add(
    buildGridEdgeLines(geom, {
      thresholdDeg: gridEdgeThresholdDeg,
      sourceMesh: mesh,
    })
  );
  return group;
}

export default function buildDiscObject3D({
  annotation,
  baseMap,
  height,
  verticalLift,
  material,
  isDome,
  // EdgesGeometry threshold of the black grid lines (Wireframe settings).
  gridEdgeThresholdDeg = 1,
}) {
  const p = annotation.point;
  const r = Number(annotation.radiusM) || 0;
  if (!p || !(r > 0)) return null;
  const local = pixelToWorld(p, baseMap); // { x, y } in basemap-local metres
  const sector = getDiscSector(annotation);
  // Openings (resolved px rings, S-C-S arcs kept) → local metres.
  const holes = (annotation.cuts ?? [])
    .map((cut) =>
      (cut?.points ?? []).map((pt) => ({
        ...pixelToWorld(pt, baseMap),
        type: pt.type,
      }))
    )
    .filter((ring) => ring.length >= 3);

  if (isDome && height > 0) {
    const dome = buildDome({
      cx: local.x,
      cy: local.y,
      r,
      height,
      sector,
      verticalLift,
      material,
      holes,
      gridEdgeThresholdDeg,
    });
    if (dome) return dome;
  }

  const ring = buildDiscRing({ cx: local.x, cy: local.y, r, sector });
  return extrudeClosedShape(ring, height, material, holes, verticalLift, [], {
    gridEdgeThresholdDeg,
  });
}
