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
    const d0 = plane.distanceToPoint(p0);
    const d1 = plane.distanceToPoint(p1);
    const d2 = plane.distanceToPoint(p2);

    // All on the same side (or coplanar): no crossing segment.
    if ((d0 > 0 && d1 > 0 && d2 > 0) || (d0 < 0 && d1 < 0 && d2 < 0)) return;

    const pts = [];
    // Edge (0,1)
    if ((d0 > 0 && d1 < 0) || (d0 < 0 && d1 > 0)) {
      pts.push(crossingPoint(p0, d0, p1, d1));
    }
    // Edge (1,2)
    if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
      pts.push(crossingPoint(p1, d1, p2, d2));
    }
    // Edge (2,0)
    if ((d2 > 0 && d0 < 0) || (d2 < 0 && d0 > 0)) {
      pts.push(crossingPoint(p2, d2, p0, d0));
    }

    // A clean straddle yields exactly two crossing points → one segment.
    // (Vertices lying exactly on the plane are rare with float coords and are
    // ignored here to avoid degenerate zero-length segments.)
    if (pts.length !== 2) return;

    const [a, b] = pts;
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
