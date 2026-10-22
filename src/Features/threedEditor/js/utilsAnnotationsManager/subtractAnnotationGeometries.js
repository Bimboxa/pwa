import { Matrix4 } from "three";
import {
  Brush,
  Evaluator,
  SUBTRACTION,
  HOLLOW_SUBTRACTION,
} from "three-bvh-csg";

import buildMergedWorldSolid from "./buildMergedWorldSolid";
import { getSolidMeshesFromObject3D } from "./getSolidMeshFromObject3D";
import { buildWallEdges } from "./extrudePolylineWall";

// Strip everything but position/normal and clear draw groups so Brush gets a
// clean triangle soup. Mutates+returns the passed geometry.
function sanitizeGeometry(geom) {
  if (!geom) return null;
  if (!geom.getAttribute("normal")) geom.computeVertexNormals();
  for (const name of Object.keys(geom.attributes)) {
    if (name !== "position" && name !== "normal") geom.deleteAttribute(name);
  }
  geom.clearGroups?.();
  return geom;
}

// Clone a mesh's geometry baked into WORLD space (its own matrixWorld applied).
function worldGeometry(mesh) {
  mesh.updateMatrixWorld?.(true);
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  return sanitizeGeometry(g);
}

// Collect every renderable mesh inside an object (a target may be a Group of
// several prism meshes — e.g. an EXTRUSION_PROFILE solid). Fat lines
// (LineSegments2 / Line2 are `isMesh`) and the partial-revolution section
// markers are decoration, never a cutting brush.
//
// A mesh3d annotation object (one Mesh per face) is merged into ONE world
// solid (`userData.mergedCutter`, geometry disposed once its brush is
// built): one brush per face would be an open sheet each, and three-bvh-csg
// classifies the host triangles by ray parity against a surface that bounds
// no volume. An OPEN mesh (a flat sheet) is skipped for the same reason.
function collectMeshes(object) {
  if (object.userData?.isAnnotationMesh3d) {
    if (object.userData.mesh3dClosed === false) {
      console.warn(
        "[subtractAnnotationGeometries] open mesh3d cutter skipped (a sheet bounds no volume)",
        object.userData.nodeId
      );
      return [];
    }
    const merged = buildMergedWorldSolid(object);
    if (!merged) return [];
    merged.userData.mergedCutter = true;
    return [merged];
  }
  const meshes = [];
  object.updateMatrixWorld?.(true);
  object.traverse?.((c) => {
    if (!c.isMesh || !c.geometry) return;
    if (c.isLineSegments2 || c.isLine2) return;
    if (c.userData?.isSectionMarker) return;
    meshes.push(c);
  });
  return meshes;
}

// A mesh3d HOST (group `isAnnotationMesh3d`, one face Mesh each) is collapsed
// into ONE solid mesh before the carve: the faces are merged in world space
// (buildMergedWorldSolid), brought back into the group's local frame and
// added as a single child with an identity transform; the face meshes are
// removed (their shared material is kept on the merged mesh). The carved
// result carries `hasSubtraction` and NO `mesh3dFaceIndex`: the host is
// display-only until « Soustraire définitivement » writes the carved mesh.
// Returns the solid meshes to carve (the merged one, or the existing single
// solid of an already-collapsed group).
function collapseMesh3dHost(group) {
  const solids = getSolidMeshesFromObject3D(group);
  const faces = solids.filter(
    (mesh) => mesh.userData?.mesh3dFaceIndex !== undefined
  );
  if (faces.length === 0) return solids;
  group.updateMatrixWorld(true);
  const merged = buildMergedWorldSolid(group, { material: faces[0].material });
  if (!merged) return [];
  merged.geometry.applyMatrix4(new Matrix4().copy(group.matrixWorld).invert());
  for (const face of faces) {
    face.parent?.remove(face);
    face.geometry?.dispose?.();
  }
  group.add(merged);
  group.updateMatrixWorld(true);
  return [merged];
}

/**
 * Carve `targetObjects` out of `sourceObject`'s solid mesh(es) with a 3D
 * boolean SUBTRACTION. Every `role === "SOLID"` mesh in the source is carved
 * (a REVOLUTION with hidden segments emits one lathe mesh per run); a mesh3d
 * host is first collapsed into one solid (collapseMesh3dHost), and a mesh3d
 * target is merged into one brush (collectMeshes). Both
 * source and targets are read in WORLD space (each mesh's own matrixWorld), so
 * the operands share a frame no matter how the objects are parented; the
 * world-space result is then mapped back into each source mesh's LOCAL frame
 * and assigned without touching the mesh transform — so the carved mesh
 * renders in exactly the same place as before (no dislocation).
 *
 * IMPORTANT: callers must have attached source + target objects to their final
 * parents (and the parents' matrices updated) BEFORE calling, so matrixWorld is
 * correct on both sides.
 *
 * @param {import("three").Object3D} sourceObject
 * @param {Array<import("three").Object3D>} targetObjects
 * @param {Object} [options]
 * @param {boolean} [options.hollow] clip-only subtraction for open surfaces.
 * @param {boolean} [options.rebuildEdges] rebuild the black grid/outline
 *   lines from the carved geometry (scene callers); headless quantity
 *   callers leave it off and pay nothing.
 * @returns {import("three").Object3D} the same sourceObject (carved), or
 *   unchanged if the boolean could not be evaluated.
 */
export default function subtractAnnotationGeometries(
  sourceObject,
  targetObjects,
  options = {}
) {
  if (!sourceObject) return sourceObject;
  const targets = (targetObjects || []).filter(Boolean);
  if (targets.length === 0) return sourceObject;

  if (getSolidMeshesFromObject3D(sourceObject).length === 0) {
    return sourceObject;
  }

  // For an OPEN surface source (e.g. an EXTRUSION_PROFILE swept surface or a
  // REVOLUTION lathe shell), use HOLLOW_SUBTRACTION: it only clips the source
  // triangles and does NOT add the target's cap faces (which a regular
  // SUBTRACTION inserts to close a volume — showing up as stray triangles
  // rendered in the source's material). Closed solids (POLYGON / RECTANGLE)
  // use a normal SUBTRACTION.
  const operation = options.hollow ? HOLLOW_SUBTRACTION : SUBTRACTION;

  try {
    const evaluator = new Evaluator();
    evaluator.attributes = ["position", "normal"];
    evaluator.useGroups = false;

    // Target brushes in WORLD space, built once and reused across source
    // meshes (evaluate does not mutate the target brush).
    const targetBrushes = [];
    for (const targetObject of targets) {
      for (const targetMesh of collectMeshes(targetObject)) {
        const targetBrush = new Brush(worldGeometry(targetMesh));
        targetBrush.updateMatrixWorld();
        targetBrushes.push(targetBrush);
        if (targetMesh.userData?.mergedCutter) targetMesh.geometry.dispose();
      }
    }
    if (targetBrushes.length === 0) return sourceObject;

    // Only now (a brush to carve with): collapsing a mesh3d host drops its
    // face meshes, which must not happen for nothing.
    const sourceMeshes = sourceObject.userData?.isAnnotationMesh3d
      ? collapseMesh3dHost(sourceObject)
      : getSolidMeshesFromObject3D(sourceObject);
    if (sourceMeshes.length === 0) return sourceObject;

    let didSubtract = false;
    for (const sourceMesh of sourceMeshes) {
      sourceMesh.updateMatrixWorld(true);
      const worldToLocal = new Matrix4().copy(sourceMesh.matrixWorld).invert();

      // Source brush in WORLD space (identity brush matrix → operates in world).
      let resultBrush = new Brush(worldGeometry(sourceMesh));
      resultBrush.updateMatrixWorld();

      for (const targetBrush of targetBrushes) {
        resultBrush = evaluator.evaluate(resultBrush, targetBrush, operation);
      }
      if (!resultBrush.geometry) continue;

      // World-space result → source mesh LOCAL frame, so the (untouched)
      // source mesh transform places it back exactly where the original
      // geometry was.
      const resultGeom = resultBrush.geometry;
      resultGeom.applyMatrix4(worldToLocal);

      const oldGeom = sourceMesh.geometry;
      sourceMesh.geometry = resultGeom;
      oldGeom?.dispose?.();

      sourceMesh.userData = {
        ...(sourceMesh.userData ?? {}),
        role: "SOLID",
        hasSubtraction: true,
      };
      didSubtract = true;
    }
    if (!didSubtract) return sourceObject;

    // Remove stale decoration children (iso lines drawn from the original,
    // un-carved outline) among the direct children, keeping every carved mesh
    // (or any child whose subtree holds one).
    const keep = new Set(sourceMeshes);
    const holdsCarvedMesh = (obj) => {
      let found = false;
      obj.traverse?.((c) => {
        if (keep.has(c)) found = true;
      });
      return found;
    };
    for (const child of (sourceObject.children || []).filter(
      (c) => !holdsCarvedMesh(c)
    )) {
      if (child.userData?.isGridEdge) continue; // handled below
      child.geometry?.dispose?.();
      child.material?.dispose?.();
      sourceObject.remove(child);
    }

    // Purge every grid-edge line (userData.isGridEdge, tagged by the builders)
    // at ANY depth: a direct child of the builder group, a grandchild when the
    // builder nests groups (open STRIP = one wall group per chunk), or a child
    // of a carved mesh (rebuilt by a previous carve of this same object).
    // They all trace the un-carved outline. The first one's material and
    // kind are remembered so the edges can be rebuilt from the carved
    // geometry below.
    let removedEdgeInfo = null;
    const staleEdges = [];
    sourceObject.traverse?.((c) => {
      if (c !== sourceObject && c.userData?.isGridEdge) staleEdges.push(c);
    });
    for (const child of staleEdges) {
      child.geometry?.dispose?.();
      if (removedEdgeInfo) {
        child.material?.dispose?.();
      } else {
        removedEdgeInfo = {
          material: child.material,
          kind: child.userData.gridEdgeKind,
        };
      }
      child.parent?.remove(child);
    }

    // Rebuild the black grid/outline from the carved geometry (only when the
    // un-carved object had one — e.g. per-vertex-Z surfaces stay edge-free).
    // Skipped by headless callers (quantities) via options.rebuildEdges.
    // The carved geometry is a triangle soup with T-junctions, so a raw
    // EdgesGeometry would slash diagonals across flat faces: buildWallEdges
    // coalesces coplanar faces first. "EDGES" lines take the current
    // Wireframe threshold (options.gridEdgeThresholdDeg, 1° when absent) so
    // the carved object needs no re-threshold in finishRoot. The face-loop
    // lines of a mesh3d host ("MESH3D", carrying `mesh3dEdges`) are rebuilt
    // as plain "EDGES" too: the collapsed solid has no face loops any more,
    // and applyWireframeSettings re-thresholds "EDGES" lines only.
    // Attached as a CHILD of the carved mesh: the carved geometry is in the
    // mesh's local frame, so an identity-transform child lands exactly on the
    // surface — and it is found again by the purge on a later re-carve.
    if (options.rebuildEdges && removedEdgeInfo) {
      const { material } = removedEdgeInfo;
      const kind =
        removedEdgeInfo.kind === "MESH3D" ? "EDGES" : removedEdgeInfo.kind;
      const seamDihedralDeg =
        kind === "WALL_PLANAR"
          ? undefined
          : (options.gridEdgeThresholdDeg ?? 1);
      for (const sourceMesh of sourceMeshes) {
        const edges = buildWallEdges(sourceMesh.geometry, {
          kind,
          material,
          seamDihedralDeg,
        });
        edges.userData.sourceMesh = sourceMesh;
        edges.userData.appliedThresholdDeg = seamDihedralDeg ?? 1;
        sourceMesh.add(edges);
      }
    }

    return sourceObject;
  } catch (e) {
    console.error("[subtractAnnotationGeometries] CSG evaluation failed", e);
    return sourceObject;
  }
}
