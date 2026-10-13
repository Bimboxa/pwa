import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  Vector3,
} from "three";

import applySurfaceCutsToSoups from "Features/threedFaceCut/utils/applySurfaceCutsToSoups";
import {
  SURFACE_CUT_REMOVE,
  getSurfaceCutsKey,
  surfaceCutToLocal,
} from "Features/threedFaceCut/utils/surfaceCutsFrame";
import buildGridEdgeLines from "./buildGridEdgeLines";

// « Découpe horizontale / verticale » of a SURFACE host (lathe, shell, swept
// profile — isSurfaceCutHost): the stored cut planes (annotation.surfaceCuts)
// partition the displayed solid into PIECES, each one its own SOLID mesh, so
// every piece hovers, selects and paints (Pinceau) as a face of its own.
//
// Run by AnnotationsManager on every (re)build of the host's root, before
// the finishing passes: the SOLID meshes of the root (role "SOLID", section
// markers left out) are baked into the root's frame (= the base map's: the
// root is an identity child of the base map group), the cuts replayed on
// them (applySurfaceCutsToSoups: only the chain of facets holding each cut's
// seed, pieces = connected components, seams carried), and each source mesh
// that got split is replaced, under its own parent, by one Mesh per piece:
// - userData = the source's (role, revolutionAxis — re-based —, half view
//   flags…) + surfaceCutPiece (index) + surfaceCutSeams (local segments) +
//   surfaceCutPieceSurface (m²); buildHostPartIndexFromObject reads
//   surfaceCutPiece to keep the pieces apart in the Pinceau's part index,
//   the piece selection (surfacePieceParts) addresses the index;
// - a piece the user deleted (a REMOVE entry of surfaceCuts) is not built.
// - material: a clone per piece (highlights tint materials);
// - black outline: an EdgesGeometry per piece (its boundary edges included:
//   the seams draw themselves) when the source had grid edges, tagged like
//   the builders' (isGridEdge / EDGES / sourceMesh, child of the piece like
//   the carve rebuild — applyWireframeSettings re-thresholds it); else only
//   the seams, as a plain line child (per-vertex-Z shells draw no grid).
// A source mesh no cut touched is left as it is.
//
// Idempotent per cut list (root.userData.surfaceCutsApplied): the carve
// pass re-finishes the same root; a swapped-in root is cut again from its
// (carved) geometry. A cut whose plane misses the surface is ignored.

const SEAM_COLOR = 0x000000;
const SEAM_OPACITY = 0.5;

// Matrix of `object` relative to `root` (the root is not necessarily in the
// scene yet: matrixWorld may be stale, local matrices are walked instead).
function getMatrixRelativeTo(object, root) {
  const matrix = new Matrix4();
  let current = object;
  while (current && current !== root) {
    current.updateMatrix();
    matrix.premultiply(current.matrix);
    current = current.parent;
  }
  return matrix;
}

function collectSolidMeshes(root) {
  const meshes = [];
  root.traverse((child) => {
    if (!child.isMesh || child.isLine2 || child.isLineSegments2) return;
    if (child.userData?.role !== "SOLID") return;
    if (child.userData?.isSectionMarker) return;
    if (child.userData?.isHoverOverlay || child.userData?.isPaintOverlay)
      return;
    meshes.push(child);
  });
  return meshes;
}

function bakeSoup(mesh, matrix) {
  const geometry = mesh.geometry;
  const position = geometry?.getAttribute?.("position");
  if (!position) return null;
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const usable = count - (count % 3);
  const out = new Float64Array(3 * usable);
  const v = new Vector3();
  for (let i = 0; i < usable; i++) {
    v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(
      matrix
    );
    out[3 * i] = v.x;
    out[3 * i + 1] = v.y;
    out[3 * i + 2] = v.z;
  }
  return out;
}

// Area (m²) of a triangle soup.
function soupSurface(positions) {
  let total = 0;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i + 8 < positions.length; i += 9) {
    a.set(positions[i], positions[i + 1], positions[i + 2]);
    b.set(positions[i + 3], positions[i + 4], positions[i + 5]);
    c.set(positions[i + 6], positions[i + 7], positions[i + 8]);
    total += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return total;
}

// The source's real material (see applyAnnotationMaterialState).
const sourceMaterialOf = (mesh) =>
  mesh.userData?.originalMaterial ?? mesh.material;

function findGridEdges(root, sourceMesh) {
  const lines = [];
  root.traverse((child) => {
    if (
      child.userData?.isGridEdge &&
      child.userData.sourceMesh === sourceMesh
    ) {
      lines.push(child);
    }
  });
  return lines;
}

function buildPieceGeometry(positions, toParent) {
  const array = new Float32Array(positions.length);
  const v = new Vector3();
  for (let i = 0; i + 2 < positions.length; i += 3) {
    v.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(
      toParent
    );
    array[i] = v.x;
    array[i + 1] = v.y;
    array[i + 2] = v.z;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(array, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildSeamLines(seams, toParent) {
  if (!seams?.length) return null;
  const flat = [];
  const v = new Vector3();
  for (const [p, q] of seams) {
    for (const point of [p, q]) {
      v.set(point.x, point.y, point.z).applyMatrix4(toParent);
      flat.push(v.x, v.y, v.z);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(Float32Array.from(flat), 3)
  );
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: SEAM_COLOR,
      transparent: true,
      opacity: SEAM_OPACITY,
    })
  );
  lines.userData = { isSurfaceCutSeam: true };
  lines.raycast = () => {};
  return lines;
}

/**
 * @param {import("three").Object3D} root - the host's annotation root
 * @param {object} annotation - the resolved annotation (surfaceCuts read)
 * @param {{imageWidth, imageHeight, meterByPx}} metrics - getBaseMapForRender
 * @returns {boolean} true when the root was partitioned
 */
export default function applySurfaceCuts(root, annotation, metrics) {
  const cuts = annotation?.surfaceCuts;
  if (!root || !metrics || !Array.isArray(cuts) || !cuts.length) return false;
  const key = getSurfaceCutsKey(cuts);
  if (root.userData?.surfaceCutsApplied === key) return false;

  const meshes = collectSolidMeshes(root);
  if (!meshes.length) return false;

  // Plane cuts ({plane, seed}) and removals ({remove: point}), in order.
  const localCuts = cuts
    .map((cut) => surfaceCutToLocal(cut, metrics))
    .filter(Boolean)
    .map((cut) =>
      cut.kind === SURFACE_CUT_REMOVE ? { remove: cut.point } : cut
    );
  if (!localCuts.length) return false;

  const relMatrices = meshes.map((mesh) => getMatrixRelativeTo(mesh, root));
  const soups = meshes.map((mesh, i) => ({
    positions: bakeSoup(mesh, relMatrices[i]) ?? new Float64Array(0),
  }));

  let result;
  try {
    result = applySurfaceCutsToSoups({ soups, cuts: localCuts });
  } catch (e) {
    console.error("[applySurfaceCuts] cut replay failed", e);
    return false;
  }
  if (!root.userData) root.userData = {};
  root.userData.surfaceCutsApplied = key;
  if (!result?.applied) return false;

  let pieceIndex = 0;
  for (let sourceIndex = 0; sourceIndex < meshes.length; sourceIndex++) {
    // A source is replaced when a cut touched it or a removal took it
    // (an untouched, removed source is simply taken down).
    const all = result.pieces.filter((p) => p.sourceIndex === sourceIndex);
    if (!all.some((p) => p.touched || p.removed)) continue;
    const pieces = all.filter((p) => !p.removed);
    const mesh = meshes[sourceIndex];
    const parent = mesh.parent ?? root;
    const toParent = getMatrixRelativeTo(parent, root).invert();
    const meshToParent = getMatrixRelativeTo(mesh, parent);

    // Outline material / kind of the source, then the stale lines go.
    const staleEdges = findGridEdges(root, mesh);
    const edgeInfo = staleEdges.length
      ? {
          material: staleEdges[0].material,
          kind: staleEdges[0].userData.gridEdgeKind ?? "EDGES",
          // Pieces keep the threshold the source lines were built with (the
          // current Wireframe setting) — no re-threshold in finishRoot.
          thresholdDeg: staleEdges[0].userData.appliedThresholdDeg ?? 1,
        }
      : null;
    for (const line of staleEdges) {
      line.geometry?.dispose?.();
      line.parent?.remove(line);
    }

    // The revolution axis is stored in the source mesh's frame: re-base it
    // on the parent's (the pieces carry no transform of their own).
    let revolutionAxis = mesh.userData?.revolutionAxis ?? null;
    if (revolutionAxis?.center) {
      const center = new Vector3(
        revolutionAxis.center.x,
        revolutionAxis.center.y,
        revolutionAxis.center.z ?? 0
      ).applyMatrix4(meshToParent);
      revolutionAxis = {
        ...revolutionAxis,
        center: { x: center.x, y: center.y, z: center.z },
      };
    }

    for (const piece of pieces) {
      const geometry = buildPieceGeometry(piece.positions, toParent);
      // The source may be wearing a highlight override at this point
      // (applyAnnotationMaterialState swaps the material in place and keeps
      // the original in userData): clone the real one.
      const pieceMesh = new Mesh(geometry, sourceMaterialOf(mesh).clone());
      pieceMesh.castShadow = mesh.castShadow;
      pieceMesh.receiveShadow = mesh.receiveShadow;
      pieceMesh.renderOrder = mesh.renderOrder;
      pieceMesh.layers.mask = mesh.layers.mask;
      // The source's cached original material (applyAnnotationMaterialState)
      // must not reach the pieces: each one owns its clone.
      const sourceUserData = { ...(mesh.userData ?? {}) };
      delete sourceUserData.originalMaterial;
      pieceMesh.userData = {
        ...sourceUserData,
        role: "SOLID",
        surfaceCutPiece: pieceIndex++,
        surfaceCutSeams: piece.seams,
        surfaceCutPieceSurface: piece.surface ?? soupSurface(piece.positions),
        ...(revolutionAxis ? { revolutionAxis } : {}),
      };
      parent.add(pieceMesh);

      if (edgeInfo) {
        pieceMesh.add(
          buildGridEdgeLines(geometry, {
            thresholdDeg: edgeInfo.thresholdDeg,
            material: edgeInfo.material.clone(),
            sourceMesh: pieceMesh,
          })
        );
      } else {
        const seams = buildSeamLines(piece.seams, toParent);
        if (seams) pieceMesh.add(seams);
      }
    }

    for (const line of staleEdges) line.material?.dispose?.();
    mesh.geometry?.dispose?.();
    // Never dispose a highlight singleton worn by the source.
    if (mesh.material === sourceMaterialOf(mesh)) mesh.material?.dispose?.();
    mesh.userData?.originalMaterial?.dispose?.();
    parent.remove(mesh);
  }
  return true;
}
