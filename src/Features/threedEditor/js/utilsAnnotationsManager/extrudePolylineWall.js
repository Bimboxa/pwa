import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Group,
  Line,
  LineLoop,
  LineBasicMaterial,
  EdgesGeometry,
  LineSegments,
  DoubleSide,
} from "three";

const EDGE_MATERIAL = new LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.5,
});

export default function extrudePolylineWall(
  points,
  height,
  material,
  closeLine,
  verticalLift = 0
) {
  if (!points || points.length < 2) return null;
  const group = new Group();

  // Per-point bottom / top, supporting offsetBottom / offsetTop on each vertex
  // (defaults to 0 for backwards-compatible callers). Points without offsets
  // collapse back to the original constant z0/z1 behavior.
  const bottoms = points.map((p) => verticalLift + (p?.offsetBottom ?? 0));
  const tops = points.map(
    (p) => verticalLift + height + (p?.offsetBottom ?? 0) + (p?.offsetTop ?? 0)
  );

  if (!height || height <= 0) {
    const positions = [];
    points.forEach((p, i) => positions.push(p.x, p.y, bottoms[i]));
    const geom = new BufferGeometry();
    geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const lineMat = new LineBasicMaterial({ color: material.color });
    group.add(closeLine ? new LineLoop(geom, lineMat) : new Line(geom, lineMat));
    return group;
  }

  const segmentCount = closeLine ? points.length : points.length - 1;
  const positions = [];
  const indices = [];
  let v = 0;
  for (let i = 0; i < segmentCount; i++) {
    const j = (i + 1) % points.length;
    const a = points[i];
    const b = points[j];
    positions.push(a.x, a.y, bottoms[i]);
    positions.push(b.x, b.y, bottoms[j]);
    positions.push(b.x, b.y, tops[j]);
    positions.push(a.x, a.y, tops[i]);
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const wallMat = material.clone();
  wallMat.side = DoubleSide;
  group.add(new Mesh(geom, wallMat));

  group.add(new LineSegments(new EdgesGeometry(geom), EDGE_MATERIAL));

  return group;
}
