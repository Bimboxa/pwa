import { BufferAttribute, BufferGeometry } from "three";
import { ADDITION, Brush, Evaluator, INTERSECTION } from "three-bvh-csg";

import { buildMesh3dFaceGeometry } from "Features/threedEditor/js/utilsAnnotationsManager/buildMesh3dAnnotationObject";
import { toNonIndexedVolume } from "Features/threedEditor/js/utilsAnnotationsManager/getSoupMeasures";

import buildMesh3dFromCarvedTriangles from "../utils/buildMesh3dFromCarvedTriangles";
import { getMesh3dSignedVolume } from "../utils/getMesh3dQties";
import isMesh3dClosed from "../utils/isMesh3dClosed";
import { reverseFace } from "../utils/mesh3dTopology";

// CSG union of two CLOSED annotation meshes (LOCAL form, same frame, absolute
// z) — the pair rule of « Fusionner les annotations » for two solids whose
// volumes overlap (a wall through a slab), where the planar merge would leave
// the faces running through each other.
//
// The brushes are built from the MESHES, not from the scene objects: the
// meshes are the very data the planar path merges (getEditableMesh3d +
// withAbsoluteZ), already free of the 1 mm z-fight lift, of the display
// shrink and of the base map pose, and the two annotations share a base map
// (DIFFERENT_BASE_MAP gate) so their local frame is a common frame. The
// result soup is read back as planar faces by buildMesh3dFromCarvedTriangles
// (three-bvh-csg leaves T-junctions between coplanar triangles), like the
// « Soustraire définitivement » bake.
//
// Overlaps smaller than this (m³) are a face / edge contact, not a volume.
export const MIN_OVERLAP_VOLUME_M3 = 1e-7;

export const UNION_MESH3D_REASONS = {
  FAILED: "FAILED",
};

// Triangle soup (non-indexed BufferGeometry) of a mesh: every face
// triangulated in its plane, CCW around its normal.
export function buildMesh3dSoupGeometry(mesh) {
  const positions = [];
  for (const face of mesh?.faces || []) {
    const geometry = buildMesh3dFaceGeometry(mesh.vertices, face, 0);
    if (!geometry) continue;
    const soup = geometry.index ? geometry.toNonIndexed() : geometry;
    positions.push(...soup.getAttribute("position").array);
    soup.dispose();
    if (soup !== geometry) geometry.dispose();
  }
  if (positions.length < 9) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.computeVertexNormals();
  return geometry;
}

function makeEvaluator() {
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  return evaluator;
}

function withBrushes(a, b, run) {
  const geometryA = buildMesh3dSoupGeometry(a);
  const geometryB = buildMesh3dSoupGeometry(b);
  try {
    if (!geometryA || !geometryB) return null;
    const brushA = new Brush(geometryA);
    const brushB = new Brush(geometryB);
    brushA.updateMatrixWorld();
    brushB.updateMatrixWorld();
    return run(brushA, brushB);
  } finally {
    geometryA?.dispose();
    geometryB?.dispose();
  }
}

// Volume (m³) shared by the two solids.
export function getMesh3dOverlapVolume(a, b) {
  return (
    withBrushes(a, b, (brushA, brushB) => {
      const result = makeEvaluator().evaluate(brushA, brushB, INTERSECTION);
      const volume = Math.abs(toNonIndexedVolume(result.geometry));
      result.geometry?.dispose();
      return volume;
    }) ?? 0
  );
}

/**
 * @returns {{ ok: true, mesh } | { ok: false, reason }} LOCAL mesh, closed,
 *   wound outward.
 */
export default function unionMesh3dSolids(a, b) {
  const mesh = withBrushes(a, b, (brushA, brushB) => {
    const result = makeEvaluator().evaluate(brushA, brushB, ADDITION);
    const geometry = result.geometry;
    if (!geometry) return null;
    const soup = geometry.index ? geometry.toNonIndexed() : geometry;
    const positions = Array.from(soup.getAttribute("position").array);
    soup.dispose();
    if (soup !== geometry) geometry.dispose();
    return buildMesh3dFromCarvedTriangles({ positions });
  });
  if (!mesh?.faces?.length || !isMesh3dClosed(mesh)) {
    return { ok: false, reason: UNION_MESH3D_REASONS.FAILED };
  }
  const volume = getMesh3dSignedVolume(mesh);
  if (volume === 0) return { ok: false, reason: UNION_MESH3D_REASONS.FAILED };
  return {
    ok: true,
    mesh:
      volume < 0
        ? { vertices: mesh.vertices, faces: mesh.faces.map(reverseFace) }
        : mesh,
  };
}
