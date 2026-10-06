import {
  BufferGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  ShapeUtils,
  Vector2,
  Vector3,
} from "three";

// Watertight solid of revolution, in the raw LatheGeometry frame (revolution
// axis = local +Y, vertex(r, y, φ) = (r·sinφ, y, r·cosφ)). The caller applies
// the same re-orientation / translation it applies to the open lathe shell.
//
// Profile closure ("vers l'axe"): an OPEN profile is closed by projecting its
// two ends onto the axis (r = 0), so the solid is the whole volume between
// the profile and the axis (a tank interior, a plain column). A profile that
// already closes on itself (first ≈ last point) is revolved as is (a torus /
// ring) — its material does not reach the axis.
//
// Output = non-indexed position/normal triangle soup with:
//   - the pole triangles (r = 0 ⇒ zero area) removed, since degenerate faces
//     break the inside/outside classification of three-bvh-csg;
//   - a consistent OUTWARD winding (the lathe normal follows the profile
//     direction: a counter-clockwise (r, y) ring gives outward normals);
//   - for a PARTIAL turn, two flat caps at φStart / φEnd (the sector's section
//     faces), so the volume stays closed.
// Returns null when the contour is degenerate (no area / < 3 points).

const AXIS_EPS = 1e-4; // metres — a point this close to the axis is ON it
const CLOSED_EPS = 1e-3; // metres — first/last point this close = closed ring
const FULL_TURN_EPS = 1e-6;
const DEGENERATE_AREA_EPS = 1e-12; // m²

// Close an OPEN lathe profile toward the axis. Returns the closed ring (no
// duplicated closing point) or null when degenerate.
export function closeProfileTowardAxis(profile) {
  if (!profile || profile.length < 2) return null;
  // Drop consecutive duplicates (a zero-length profile edge yields a
  // zero-area lathe quad).
  const pts = profile.filter(
    (p, i) => i === 0 || p.distanceTo(profile[i - 1]) > 1e-7
  );
  if (pts.length < 2) return null;

  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length >= 4 && first.distanceTo(last) < CLOSED_EPS) {
    // Already a closed contour: drop the duplicated closing point.
    return pts.slice(0, -1);
  }
  const ring = [...pts];
  if (first.x > AXIS_EPS) ring.unshift(new Vector2(0, first.y));
  if (last.x > AXIS_EPS) ring.push(new Vector2(0, last.y));
  return ring.length >= 3 ? ring : null;
}

function ringSignedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

function latheVertex(r, y, phi) {
  return [r * Math.sin(phi), y, r * Math.cos(phi)];
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _ab = new Vector3();
const _ac = new Vector3();

/**
 * @param {Object} params
 * @param {Array<Vector2>} params.profile  lathe-local profile (x = radius,
 *   y = height), open or closed, in metres
 * @param {number} params.segments        lathe segments over the swept angle
 * @param {number} [params.phiStart]
 * @param {number} [params.phiLength]
 * @returns {BufferGeometry|null}
 */
export default function buildRevolutionSolidGeometry({
  profile,
  segments,
  phiStart = 0,
  phiLength = Math.PI * 2,
}) {
  let ring = closeProfileTowardAxis(profile);
  if (!ring) return null;
  const signedArea = ringSignedArea(ring);
  if (Math.abs(signedArea) < DEGENERATE_AREA_EPS) return null;
  // Counter-clockwise (r, y) ring ⇒ LatheGeometry normals point outward.
  if (signedArea < 0) ring = ring.slice().reverse();

  const isPartial = phiLength < Math.PI * 2 - FULL_TURN_EPS;
  const phiEnd = phiStart + phiLength;

  // Lathe surface over the closed ring (the ring is closed again by
  // repeating its first point).
  const lathe = new LatheGeometry(
    [...ring, ring[0]],
    Math.max(3, segments),
    phiStart,
    phiLength
  );
  const positions = [];
  const pushTriangle = (a, b, c) => {
    _a.set(a[0], a[1], a[2]);
    _b.set(b[0], b[1], b[2]);
    _c.set(c[0], c[1], c[2]);
    _ab.subVectors(_b, _a);
    _ac.subVectors(_c, _a);
    if (_ab.cross(_ac).length() * 0.5 < DEGENERATE_AREA_EPS) return;
    positions.push(...a, ...b, ...c);
  };
  const lathePos = lathe.getAttribute("position");
  const latheIdx = lathe.getIndex();
  const readVertex = (i) => [
    lathePos.getX(i),
    lathePos.getY(i),
    lathePos.getZ(i),
  ];
  for (let t = 0; t < latheIdx.count; t += 3) {
    pushTriangle(
      readVertex(latheIdx.getX(t)),
      readVertex(latheIdx.getX(t + 1)),
      readVertex(latheIdx.getX(t + 2))
    );
  }
  lathe.dispose();

  // Section caps of a partial sweep. Outward direction at a boundary is the
  // sweep tangent ±(cosφ, 0, −sinφ): −tangent at φStart, +tangent at φEnd.
  if (isPartial) {
    let faces = null;
    try {
      faces = ShapeUtils.triangulateShape(ring, []);
    } catch {
      faces = null;
    }
    if (!faces?.length) return null;
    const pushCap = (phi, outwardSign) => {
      const outward = new Vector3(
        Math.cos(phi) * outwardSign,
        0,
        -Math.sin(phi) * outwardSign
      );
      const verts = ring.map((p) => latheVertex(p.x, p.y, phi));
      for (const [i0, i1, i2] of faces) {
        const a = verts[i0];
        const b = verts[i1];
        const c = verts[i2];
        _a.set(a[0], a[1], a[2]);
        _b.set(b[0], b[1], b[2]);
        _c.set(c[0], c[1], c[2]);
        _ab.subVectors(_b, _a);
        _ac.subVectors(_c, _a);
        const flip = _ab.cross(_ac).dot(outward) < 0;
        if (flip) pushTriangle(a, c, b);
        else pushTriangle(a, b, c);
      }
    };
    pushCap(phiStart, -1);
    pushCap(phiEnd, 1);
  }

  if (positions.length < 9) return null;

  // Safety net: the divergence-theorem volume of a closed, outward-oriented
  // soup is positive. Flip everything if the contour conventions above ever
  // disagree with the sampled geometry.
  let volume6 = 0;
  for (let i = 0; i < positions.length; i += 9) {
    _a.set(positions[i], positions[i + 1], positions[i + 2]);
    _b.set(positions[i + 3], positions[i + 4], positions[i + 5]);
    _c.set(positions[i + 6], positions[i + 7], positions[i + 8]);
    volume6 += _a.dot(_b.cross(_c));
  }
  if (volume6 < 0) {
    for (let i = 0; i < positions.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const tmp = positions[i + 3 + k];
        positions[i + 3 + k] = positions[i + 6 + k];
        positions[i + 6 + k] = tmp;
      }
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}
