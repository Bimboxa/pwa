import { Vector3 } from "three";

// Compute the section contour of a clipping plane against a set of meshes:
// the set of line segments where `plane` crosses each triangle.
//
// For every triangle we take the signed distance of its 3 vertices to the
// plane; a triangle that straddles the plane has exactly two edges whose
// endpoints differ in sign. Interpolating the crossing point on each of those
// two edges yields one segment lying on the plane.
//
// All geometry is read in WORLD space (mesh.matrixWorld) — annotation meshes
// live under basemap groups with their own position/rotation, exactly like the
// snap index built in useVertexSnap.buildIndex.
//
// `meshes` is a flat list of THREE.Mesh. Returns:
//   { positions: number[] (flat [ax,ay,az, bx,by,bz, ...] for
//     LineSegmentsGeometry), segments: [{ a: Vector3, b: Vector3 }] }
export default function computePlaneSectionSegments(plane, meshes) {
  const positions = [];
  const segments = [];
  if (!plane || !meshes || meshes.length === 0) {
    return { positions, segments };
  }

  const va = new Vector3();
  const vb = new Vector3();
  const vc = new Vector3();

  // A vertex within EPS (world units, meters) of the plane is treated as lying
  // ON it. Without this, a triangle with one vertex exactly on the plane and the
  // other two straddling yields only ONE strict edge crossing and gets dropped —
  // punching gaps in the contour wherever the plane grazes a vertex ring of a
  // tessellated curved surface (lathe / swept profile).
  const EPS = 1e-5;

  // Interpolate the point where edge (p0,p1) crosses the plane, given their
  // signed distances (opposite signs guaranteed by the caller).
  function crossingPoint(p0, d0, p1, d1) {
    const t = d0 / (d0 - d1);
    return new Vector3(
      p0.x + (p1.x - p0.x) * t,
      p0.y + (p1.y - p0.y) * t,
      p0.z + (p1.z - p0.z) * t
    );
  }

  function addTriangle(p0, p1, p2) {
    const verts = [p0, p1, p2];
    const d = [
      plane.distanceToPoint(p0),
      plane.distanceToPoint(p1),
      plane.distanceToPoint(p2),
    ];
    // side: +1 / -1 / 0 (on plane)
    const side = d.map((v) => (v > EPS ? 1 : v < -EPS ? -1 : 0));

    // All strictly on the same side → no crossing.
    if (side[0] > 0 && side[1] > 0 && side[2] > 0) return;
    if (side[0] < 0 && side[1] < 0 && side[2] < 0) return;

    const pts = [];
    const addPt = (p) => {
      if (!pts.some((q) => q.distanceToSquared(p) < EPS * EPS)) pts.push(p);
    };

    // Vertices lying on the plane are themselves crossing points.
    for (let i = 0; i < 3; i++) {
      if (side[i] === 0) addPt(verts[i].clone());
    }
    // Edges whose endpoints are on strictly opposite sides.
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      if (side[i] * side[j] < 0) {
        addPt(crossingPoint(verts[i], d[i], verts[j], d[j]));
      }
    }

    // A clean crossing yields exactly two distinct points → one segment.
    // (0/1 point = a vertex/edge merely touches the plane; 3 = the whole
    // triangle is coplanar — both ignored to avoid degenerate clutter.)
    if (pts.length !== 2) return;

    const [a, b] = pts;
    if (a.distanceToSquared(b) <= EPS * EPS) return;
    segments.push({ a, b });
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }

  for (const mesh of meshes) {
    const geom = mesh?.geometry;
    const pos = geom?.attributes?.position;
    if (!pos) continue;
    mesh.updateWorldMatrix(true, false);
    const m = mesh.matrixWorld;

    const readWorld = (i, out) => {
      out.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
    };

    const indexAttr = geom.index;
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        readWorld(indexAttr.getX(i), va);
        readWorld(indexAttr.getX(i + 1), vb);
        readWorld(indexAttr.getX(i + 2), vc);
        addTriangle(va, vb, vc);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        readWorld(i, va);
        readWorld(i + 1, vb);
        readWorld(i + 2, vc);
        addTriangle(va, vb, vc);
      }
    }
  }

  return { positions, segments };
}
