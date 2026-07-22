import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { lighten } from "@mui/material/styles";

import { MESH3D_LIFT_M } from "./mesh3dConstants.js";

// THREE.Mesh of a curved ("coque") maille: the stored triangle soup as ONE
// double-sided surface, lifted along smoothed vertex normals (averaging over
// the triangles sharing a vertex avoids the cracks a per-face lift would open
// between facets).
//
// Outline: EdgesGeometry at `edgeAngleDeg` — the same angle that grew the
// region — so only the boundary and real creases are drawn, never the smooth
// facet seams.

function safeLighten(color, amount, fallback) {
  try {
    return lighten(color, amount);
  } catch {
    return fallback;
  }
}

export default function buildShellGeometry(
  shell,
  { color, edgeColor, selected, dimmed, edgeAngleDeg = 25 } = {}
) {
  const source = shell?.positions;
  if (!source || source.length < 9) return null;

  const count = Math.floor(source.length / 3); // vertices
  const positions = new Float32Array(source.length);

  // Smoothed normal per welded vertex position (0.1 mm quantization, the same
  // weld used by the region utils).
  const normalByKey = new Map();
  const key = (i) =>
    `${Math.round(source[3 * i] * 1e4)},${Math.round(
      source[3 * i + 1] * 1e4
    )},${Math.round(source[3 * i + 2] * 1e4)}`;

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  for (let t = 0; t < count / 3; t++) {
    const i0 = 3 * t;
    a.fromArray(source, 3 * i0);
    b.fromArray(source, 3 * (i0 + 1));
    c.fromArray(source, 3 * (i0 + 2));
    n.subVectors(b, a).cross(c.sub(a));
    // Raw cross product: its length is twice the area, so accumulating it
    // weights each face by area for free.
    for (let k = 0; k < 3; k++) {
      const vk = key(i0 + k);
      const acc = normalByKey.get(vk);
      if (acc) acc.add(n);
      else normalByKey.set(vk, n.clone());
    }
  }

  for (let i = 0; i < count; i++) {
    const acc = normalByKey.get(key(i));
    const len = acc ? acc.length() : 0;
    const lift = len > 0 ? MESH3D_LIFT_M / len : 0;
    positions[3 * i] = source[3 * i] + (acc?.x || 0) * lift;
    positions[3 * i + 1] = source[3 * i + 1] + (acc?.y || 0) * lift;
    positions[3 * i + 2] = source[3 * i + 2] + (acc?.z || 0) * lift;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({
    color: selected ? safeLighten(color, 0.3, color) : color,
    transparent: true,
    opacity: dimmed ? 0.2 : 0.9,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const mesh = new Mesh(geometry, material);

  const edges = new LineSegments(
    new EdgesGeometry(geometry, edgeAngleDeg),
    new LineBasicMaterial({
      color: selected ? 0x2196f3 : edgeColor || 0x333333,
      transparent: true,
      opacity: dimmed ? 0.25 : 1,
    })
  );
  edges.raycast = () => {};
  edges.renderOrder = 999;
  mesh.add(edges);

  return mesh;
}
