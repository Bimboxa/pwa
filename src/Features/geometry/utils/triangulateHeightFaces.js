import { ShapeUtils, Vector2 } from "three";

const PLAIN_SIDE = { hidden: false, label: 0 };

// Stepped build of a FLAT polygon whose faces sit at different levels
// (height cuts — heightCuts/utils/computeHeightFaces): a podium, a pit.
// Called by triangulateAnnotationGeometry, same units and same output shape.
//
// faces: [{ points, holes, delta, side }] — the partition of the polygon
//   (rings in the units of the caller, no T-junction between two faces),
//   delta in the units of `height`, side "TOP" | "BOTTOM".
// Levels of a face:
//   sheet (height 0):  z = lift + delta                       (side ignored)
//   prism:             top    = lift + height + (TOP ? delta : 0)
//                      bottom = lift + (BOTTOM ? delta : 0)   (top ≥ bottom)
//
// Every face is triangulated on its own at its levels. Along an edge shared
// by two faces, each face raises the part of its wall the other one does not
// cover (the riser of the step); border edges get the plain wall of a prism
// (with `getSideMeta`: hidden segments skipped, labels kept). The result is a
// closed solid for a prism.
//
// Returns the triangulateAnnotationGeometry result + `areaRisers` (vertical
// faces between two faces, NOT included in `areaSides`), or null when the
// faces cannot be built.
export default function triangulateHeightFaces({
  faces,
  contourSign = 1,
  height = 0,
  verticalLift = 0,
  unitScale = 1,
  openTop = false,
  getSideMeta = null,
}) {
  const isExtruded = height > 0;
  const built = [];
  let extent = 0;
  for (const face of faces || []) {
    if (!(face?.points?.length >= 3)) continue;
    const delta = Number(face.delta) || 0;
    const isBottom = face.side === "BOTTOM";
    const bottom = verticalLift + (isExtruded && isBottom ? delta : 0);
    const top = isExtruded
      ? Math.max(bottom, verticalLift + height + (isBottom ? 0 : delta))
      : verticalLift + delta;
    // Rings wound like the polygon's contour (holes the other way), so the
    // caps and the walls face the same way as on the plain build.
    const contour = orient(face.points, contourSign);
    const holes = (face.holes || [])
      .filter((hole) => hole?.length >= 3)
      .map((hole) => orient(hole, -contourSign));
    for (const p of contour) {
      extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
    }
    built.push({ contour, holes, top, bottom });
  }
  if (!built.length) return null;

  // Which faces run along each edge.
  const eps = Math.max(extent, 1) * 1e-7;
  const pointKey = (p) => `${Math.round(p.x / eps)}_${Math.round(p.y / eps)}`;
  const edgeKey = (a, b) => {
    const ka = pointKey(a);
    const kb = pointKey(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const facesByEdge = new Map();
  for (const face of built) {
    for (const ring of [face.contour, ...face.holes]) {
      for (let i = 0; i < ring.length; i++) {
        const key = edgeKey(ring[i], ring[(i + 1) % ring.length]);
        const list = facesByEdge.get(key);
        if (list) list.push(face);
        else facesByEdge.set(key, [face]);
      }
    }
  }

  const positions = [];
  const indices = [];
  const pushQuad = (a, b, z0, z1) => {
    const v0 = positions.length / 3;
    positions.push(a.x, a.y, z0, b.x, b.y, z0, b.x, b.y, z1, a.x, a.y, z1);
    indices.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  };

  // 1. TOP FACES
  const triangulated = [];
  for (const face of built) {
    const flat = [face.contour, ...face.holes].flat();
    let tris;
    try {
      tris =
        ShapeUtils.triangulateShape(
          face.contour.map((p) => new Vector2(p.x, p.y)),
          face.holes.map((hole) => hole.map((p) => new Vector2(p.x, p.y)))
        ) || [];
    } catch {
      return null;
    }
    triangulated.push({ face, flat, tris });
  }
  const topStart = indices.length;
  if (!(openTop && isExtruded)) {
    for (const { face, flat, tris } of triangulated) {
      const base = positions.length / 3;
      for (const p of flat) positions.push(p.x, p.y, face.top);
      for (const [a, b, c] of tris) indices.push(base + a, base + b, base + c);
    }
  }
  const topRange = [topStart, indices.length - topStart];

  // 2. BOTTOM FACES (prism only, reversed winding)
  const bottomStart = indices.length;
  if (isExtruded) {
    for (const { face, flat, tris } of triangulated) {
      const base = positions.length / 3;
      for (const p of flat) positions.push(p.x, p.y, face.bottom);
      for (const [a, b, c] of tris) indices.push(base + a, base + c, base + b);
    }
  }
  const bottomRange = [bottomStart, indices.length - bottomStart];

  // 3. BORDER WALLS (prism only) — edges with no neighbor face.
  const sideLabels = [];
  const sideStart = indices.length;
  const steps = [];
  for (const face of built) {
    for (const ring of [face.contour, ...face.holes]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const others = facesByEdge
          .get(edgeKey(a, b))
          .filter((other) => other !== face);
        if (others.length) {
          steps.push({ face, other: others[0], a, b });
          continue;
        }
        if (!isExtruded || !(face.top > face.bottom)) continue;
        const meta = getSideMeta ? getSideMeta(a, b) : PLAIN_SIDE;
        if (meta.hidden) continue;
        sideLabels.push(meta.label, meta.label);
        pushQuad(a, b, face.bottom, face.top);
      }
    }
  }
  const sideRange = [sideStart, indices.length - sideStart];

  // 4. RISERS — along a shared edge, the part of this face's wall that the
  // neighbor does not cover. A sheet has one level: the riser joins the two
  // sheets, raised once (by the higher face).
  const riserStart = indices.length;
  for (const { face, other, a, b } of steps) {
    if (!isExtruded) {
      if (face.top > other.top + eps) pushQuad(a, b, other.top, face.top);
      continue;
    }
    if (other.bottom > face.bottom + eps) {
      pushQuad(a, b, face.bottom, Math.min(face.top, other.bottom));
    }
    if (other.top < face.top - eps) {
      pushQuad(a, b, Math.max(face.bottom, other.top), face.top);
    }
  }
  const riserRange = [riserStart, indices.length - riserStart];

  let triLabels = null;
  if (sideLabels.some((label) => label !== 0)) {
    triLabels = new Int32Array(indices.length / 3);
    triLabels.set(sideLabels, sideRange[0] / 3);
  }

  // 5. QUANTITIES
  let areaPlanar = 0;
  let volume = 0;
  for (const face of built) {
    let area = Math.abs(signedArea(face.contour));
    for (const hole of face.holes) area -= Math.abs(signedArea(hole));
    area = Math.max(0, area);
    areaPlanar += area;
    if (isExtruded) volume += area * (face.top - face.bottom);
  }
  const quadsArea = ([start, count]) => {
    let total = 0;
    for (let k = start; k < start + count; k += 6) {
      const i0 = indices[k] * 3;
      const i1 = indices[k + 1] * 3;
      const i2 = indices[k + 2] * 3;
      const length = Math.hypot(
        positions[i1] - positions[i0],
        positions[i1 + 1] - positions[i0 + 1]
      );
      total += length * Math.abs(positions[i2 + 2] - positions[i1 + 2]);
    }
    return total;
  };

  const k2 = unitScale * unitScale;
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    isoSegments: null,
    isoPartitionApplied: false,
    shellApplied: null,
    shellProfileSegments: null,
    heightFacesApplied: true,
    topRange,
    bottomRange,
    // Border walls, then the risers (the readers of `sideRange` — face
    // labels — only know the border walls).
    sideRange,
    riserRange,
    triLabels,
    areaPlanar: areaPlanar * k2,
    areaTop: (openTop && isExtruded ? 0 : areaPlanar) * k2,
    areaBottom: (isExtruded ? areaPlanar : 0) * k2,
    areaSides: quadsArea(sideRange) * k2,
    areaRisers: quadsArea(riserRange) * k2,
    volume: volume * k2 * unitScale,
  };
}

function signedArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function orient(ring, sign) {
  const area = signedArea(ring);
  return area !== 0 && Math.sign(area) !== Math.sign(sign)
    ? [...ring].reverse()
    : ring;
}
