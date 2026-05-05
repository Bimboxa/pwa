import { Vector2, ShapeUtils } from "three";

// Triangulate a 2D contour (+ optional holes) into a non-planar 3D mesh,
// applying per-point Z lifts. Used both for 3D rendering (extrudeClosedShape's
// per-vertex-Z path) and for quantity computation (getAnnotationQties), so the
// two stay in sync when points carry offsetBottom / offsetTop.
//
// Z math, per point:
//   bottom = verticalLift + (p.offsetBottom ?? 0)
//   top    = verticalLift + height + (p.offsetBottom ?? 0) + (p.offsetTop ?? 0)
//
// Inputs are 2D in caller-consistent units (pixels for quantity callers, local
// world units for 3D callers). `unitScale` (= meters per input-unit, e.g.
// `meterByPx` for pixel callers) lets the result expose areas in m² without
// the caller having to do the conversion.
//
// Output shape:
//   { positions, indices, topRange, bottomRange, sideRange,
//     areaPlanar, areaTop, areaBottom, areaSides, volume }
//
// All `area*` and `volume` values are scaled by `unitScale` (^2 for areas,
// ^3 for volume). `positions` and `indices` are mesh-ready and are NOT scaled
// (they remain in input units, since the 3D consumer applies the basemap
// transform separately).
export default function triangulateAnnotationGeometry({
  contour,
  holes = [],
  height = 0,
  verticalLift = 0,
  unitScale = 1,
  zFightOffset = 0,
}) {
  if (!Array.isArray(contour) || contour.length < 3) {
    return emptyResult();
  }

  // Vector2 lists for THREE.ShapeUtils.triangulateShape
  const contourV2 = contour.map((p) => new Vector2(p.x, p.y));
  const validHoles = (holes || []).filter(
    (h) => Array.isArray(h) && h.length >= 3
  );
  const holesV2 = validHoles.map((h) => h.map((p) => new Vector2(p.x, p.y)));

  // triangulateShape returns triangle index triplets [i, j, k] over the
  // concatenated [contour, ...holes] flat array.
  const tris = ShapeUtils.triangulateShape(contourV2, holesV2) || [];

  const flatPts = [contour, ...validHoles].flat();
  const isExtruded = height > 0;

  const positions = [];
  const indices = [];

  // 1. TOP FACE — one vertex per flat point, lifted to its top z.
  const topBase = 0;
  for (const p of flatPts) {
    const z =
      verticalLift + height + (p.offsetBottom ?? 0) + (p.offsetTop ?? 0) + zFightOffset;
    positions.push(p.x, p.y, z);
  }
  const topStart = indices.length;
  for (const [a, b, c] of tris) {
    indices.push(topBase + a, topBase + b, topBase + c);
  }
  const topRange = [topStart, indices.length - topStart];

  let bottomRange = [0, 0];
  let sideRange = [0, 0];
  let bottomBase = -1;

  if (isExtruded) {
    // 2. BOTTOM FACE — same vertices at bottom z, reversed winding so the
    // normal points downward.
    bottomBase = positions.length / 3;
    for (const p of flatPts) {
      const z = verticalLift + (p.offsetBottom ?? 0) + zFightOffset;
      positions.push(p.x, p.y, z);
    }
    const bottomStart = indices.length;
    for (const [a, b, c] of tris) {
      indices.push(bottomBase + a, bottomBase + c, bottomBase + b);
    }
    bottomRange = [bottomStart, indices.length - bottomStart];

    // 3. SIDE WALLS — outer contour and each hole. For holes, reverse winding
    // so the wall faces inward (toward the hole).
    const sideStart = indices.length;
    emitRingWalls(positions, indices, contour, height, verticalLift, zFightOffset, false);
    for (const h of validHoles) {
      emitRingWalls(positions, indices, h, height, verticalLift, zFightOffset, true);
    }
    sideRange = [sideStart, indices.length - sideStart];
  }

  // 4. QUANTITIES — areas computed from the actual 3D vertex positions.
  const areaPlanar = ringPlanarArea(contour) - validHoles.reduce((s, h) => s + ringPlanarArea(h), 0);
  const areaTop = sumTriangleAreas3D(positions, indices, topRange);
  const areaBottom = isExtruded
    ? sumTriangleAreas3D(positions, indices, bottomRange)
    : 0;
  const areaSides = isExtruded
    ? sumTriangleAreas3D(positions, indices, sideRange)
    : 0;

  // Volume of the slanted prism: per top triangle, the prism above its planar
  // footprint has volume = planarTriArea * avgVerticalSpan, where
  // avgVerticalSpan = avg(top_z - bottom_z) over the triangle's three vertices.
  let volume = 0;
  if (isExtruded) {
    for (const [a, b, c] of tris) {
      const planarArea = Math.abs(triPlanarArea(flatPts[a], flatPts[b], flatPts[c]));
      const spanA = height + (flatPts[a].offsetTop ?? 0);
      const spanB = height + (flatPts[b].offsetTop ?? 0);
      const spanC = height + (flatPts[c].offsetTop ?? 0);
      volume += planarArea * ((spanA + spanB + spanC) / 3);
    }
  }

  const k2 = unitScale * unitScale;
  const k3 = k2 * unitScale;

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    topRange,
    bottomRange,
    sideRange,
    areaPlanar: areaPlanar * k2,
    areaTop: areaTop * k2,
    areaBottom: areaBottom * k2,
    areaSides: areaSides * k2,
    volume: volume * k3,
  };
}

function emptyResult() {
  return {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
    topRange: [0, 0],
    bottomRange: [0, 0],
    sideRange: [0, 0],
    areaPlanar: 0,
    areaTop: 0,
    areaBottom: 0,
    areaSides: 0,
    volume: 0,
  };
}

// Per consecutive pair (p_i, p_{i+1}) on a closed ring, push a quad with
// per-point bottom/top z. Reverse winding for hole rings.
function emitRingWalls(positions, indices, ring, height, verticalLift, zFightOffset, reverseWinding) {
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i];
    const b = ring[j];
    const aBot = verticalLift + (a.offsetBottom ?? 0) + zFightOffset;
    const bBot = verticalLift + (b.offsetBottom ?? 0) + zFightOffset;
    const aTop =
      verticalLift + height + (a.offsetBottom ?? 0) + (a.offsetTop ?? 0) + zFightOffset;
    const bTop =
      verticalLift + height + (b.offsetBottom ?? 0) + (b.offsetTop ?? 0) + zFightOffset;
    const v0 = positions.length / 3;
    positions.push(a.x, a.y, aBot, b.x, b.y, bBot, b.x, b.y, bTop, a.x, a.y, aTop);
    if (reverseWinding) {
      indices.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
    } else {
      indices.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
    }
  }
}

// 2D shoelace (signed area absolute value) for a closed ring.
function ringPlanarArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function triPlanarArea(a, b, c) {
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

// Sum 3D triangle areas in the [start, count] index slice using the actual
// vertex positions in the buffer. Each triple of indices forms one triangle.
function sumTriangleAreas3D(positions, indices, [start, count]) {
  let total = 0;
  for (let k = 0; k < count; k += 3) {
    const i0 = indices[start + k] * 3;
    const i1 = indices[start + k + 1] * 3;
    const i2 = indices[start + k + 2] * 3;
    const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
    const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
    const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];
    // (b - a) x (c - a)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    total += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
  }
  return total;
}
