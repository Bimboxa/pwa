import { useCallback, useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  clearMeshAdjacency,
  setMeshAdjacency,
} from "../services/meshGraphStore";
import quantizeVertex from "../utils/quantizeVertex";

// Two triangle normals are "the same plane" above this |dot| (≈ 5°).
const COPLANAR_NORMAL_DOT = 0.9962;

// Build, in a single scene traversal:
//   - a flat list of world-space mesh vertices for cursor → vertex snap
//   - a quantized adjacency map from the same meshes' triangles, used by
//     the snap helpers (vertex alignment along existing edges, rotation
//     overlays) — a drawn shape is never closed through it
// Only FEATURE edges enter the adjacency: border edges (one triangle) and
// edges shared by non-coplanar triangles. Interior triangulation diagonals
// of a planar face (earcut artifacts, invisible to the user) are dropped —
// they are no edge the user can see or align with.
// Snappable = baseMap meshes (userData.isBasemap), existing annotation
// meshes (userData.nodeType === "ANNOTATION") and maille shells
// (userData.isMesh3d) — cut mailles carry vertices (cut endpoints,
// mid-edge points) that exist nowhere else. Objects hidden via an
// ancestor's `visible = false` (e.g. "Masquer les annotations") are
// skipped.
// options.excludeSubtree: an Object3D whose whole subtree is skipped — used
// by the "Déplacer" tool to build a target-only index that never contains
// the carried base map (its own geometry would otherwise screen the drop
// targets, with stale world positions on top).
// options.excludeSubtrees: same, plural (array or Set of Object3D) — used by
// the annotation move/rotate tools which carry several annotation roots.
// options.annotationsOnly: only annotation meshes (an ancestor with
// userData.nodeType === "ANNOTATION") are snappable — base map planes and
// mailles are skipped. Used by the annotation move/rotate tools whose grab
// click must land on an annotation.
export function buildIndex(scene, options = {}) {
  const verts = [];
  // key -> { position, neighbors: Set<key>, nodeIds: Set<annotationId> }
  const adjacency = new Map();
  if (!scene) return { verts, adjacency };
  const excludeSet = new Set(options.excludeSubtrees ?? []);
  if (options.excludeSubtree) excludeSet.add(options.excludeSubtree);
  const annotationsOnly = !!options.annotationsOnly;

  function ensureNode(key, position, nodeId) {
    let entry = adjacency.get(key);
    if (!entry) {
      entry = { position, neighbors: new Set(), nodeIds: new Set() };
      adjacency.set(key, entry);
    }
    if (nodeId) entry.nodeIds.add(nodeId);
    return entry;
  }

  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.visible) return;
    if (obj.userData?.isHoverOverlay) return; // transient face stipple
    if (obj.userData?.isPaintOverlay) return; // painted part (Pinceau) skin
    if (obj.userData?.isGridPlaceholder) return; // base maps grid decorations
    if (obj.userData?.isDecor) return; // scan base maps (no CPU geometry)
    if (obj.userData?.isHatchFill) return; // hatched fill band / lines
    if (obj.userData?.isRevolutionAxisCircle) return; // axis base circle (decoration)
    let isSnappable = false;
    let nodeId = null; // owning annotation, when there is one
    let parent = obj;
    while (parent) {
      if (parent.visible === false) return; // hidden by an ancestor
      if (excludeSet.has(parent)) return;
      if (parent.userData?.nodeType === "ANNOTATION") {
        nodeId = parent.userData.nodeId ?? nodeId;
      }
      if (
        parent.userData?.nodeType === "ANNOTATION" ||
        (!annotationsOnly &&
          (parent.userData?.isBasemap || parent.userData?.isMesh3d))
      ) {
        isSnappable = true;
      }
      parent = parent.parent;
    }
    if (!isSnappable) return;

    // Fat lines (Line2) hold INSTANCED geometry — their `position` attribute
    // is the segment quad template, not the line: never index it. A flat
    // polyline (userData.isSnapLine, see extrudePolylineWall) is indexed from
    // its source points instead (userData.exportLine, local space): its
    // points snap, its segments are edges.
    if (obj.isLine2 || obj.isLineSegments2) {
      const linePositions = obj.userData?.isSnapLine
        ? obj.userData.exportLine?.positions
        : null;
      if (!linePositions) return;
      obj.updateWorldMatrix(true, false);
      let prevKey = null;
      for (let i = 0; i + 2 < linePositions.length; i += 3) {
        const worldPos = new Vector3(
          linePositions[i],
          linePositions[i + 1],
          linePositions[i + 2]
        ).applyMatrix4(obj.matrixWorld);
        const key = quantizeVertex(worldPos);
        if (!adjacency.has(key)) {
          verts.push({ position: worldPos, meshKey: obj.uuid, nodeId });
        }
        ensureNode(key, worldPos, nodeId);
        if (prevKey && prevKey !== key) {
          adjacency.get(prevKey).neighbors.add(key);
          adjacency.get(key).neighbors.add(prevKey);
        }
        prevKey = key;
      }
      return;
    }

    const geom = obj.geometry;
    const pos = geom?.attributes?.position;
    if (!pos) return;
    obj.updateWorldMatrix(true, false);
    const meshKey = obj.uuid;
    const tmp = new Vector3();
    const idxToKey = new Map();
    const worldByIdx = [];

    for (let i = 0; i < pos.count; i++) {
      tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      tmp.applyMatrix4(obj.matrixWorld);
      const worldPos = new Vector3(tmp.x, tmp.y, tmp.z);
      verts.push({ position: worldPos, meshKey, nodeId });
      worldByIdx[i] = worldPos;
      const k = quantizeVertex(worldPos);
      idxToKey.set(i, k);
      ensureNode(k, worldPos, nodeId);
    }

    // Per-edge triangle bookkeeping for the feature-edge filter. Degenerate
    // triangles (null normal) and non-manifold edges keep the edge (safe
    // direction — dropping is only for the unambiguous coplanar-pair case).
    const edgeInfo = new Map(); // "kMin|kMax" -> {ka, kb, normal, count, keepFlag}

    function addTriEdge(ia, ib, normal) {
      const ka = idxToKey.get(ia);
      const kb = idxToKey.get(ib);
      if (!ka || !kb || ka === kb) return;
      const edgeKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const entry = edgeInfo.get(edgeKey);
      if (!entry) {
        edgeInfo.set(edgeKey, {
          ka,
          kb,
          normal,
          count: 1,
          keepFlag: normal === null,
        });
        return;
      }
      entry.count += 1;
      if (entry.keepFlag) return;
      if (normal === null) {
        entry.keepFlag = true;
        return;
      }
      // |dot| so opposite windings still read as coplanar.
      const d = Math.abs(
        entry.normal.x * normal.x +
          entry.normal.y * normal.y +
          entry.normal.z * normal.z
      );
      if (d < COPLANAR_NORMAL_DOT) entry.keepFlag = true;
    }

    function addTriangle(ia, ib, ic) {
      const pa = worldByIdx[ia];
      const pb = worldByIdx[ib];
      const pc = worldByIdx[ic];
      const ux = pb.x - pa.x,
        uy = pb.y - pa.y,
        uz = pb.z - pa.z;
      const vx = pc.x - pa.x,
        vy = pc.y - pa.y,
        vz = pc.z - pa.z;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const normal =
        nLen > 1e-12 ? { x: nx / nLen, y: ny / nLen, z: nz / nLen } : null;
      addTriEdge(ia, ib, normal);
      addTriEdge(ib, ic, normal);
      addTriEdge(ic, ia, normal);
    }

    const indexAttr = geom.index;
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        addTriangle(
          indexAttr.getX(i),
          indexAttr.getX(i + 1),
          indexAttr.getX(i + 2)
        );
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        addTriangle(i, i + 1, i + 2);
      }
    }

    for (const entry of edgeInfo.values()) {
      // Shared by 2+ coplanar triangles = interior triangulation diagonal.
      if (entry.count > 1 && !entry.keepFlag) continue;
      adjacency.get(entry.ka).neighbors.add(entry.kb);
      adjacency.get(entry.kb).neighbors.add(entry.ka);
    }
  });

  return { verts, adjacency };
}

// React hook returning a `findNearestSnap` function that, given a mouse
// position in NDC, the active camera, and the canvas size, returns the
// closest snappable vertex in screen-space as `{position, meshKey, nodeId?}`, or null
// if none is within `pixelThreshold`. `options.accept(position)` filters the
// candidates (e.g. drops the vertices hidden behind the surface under the
// cursor — the next closest one then wins). Also publishes the mesh-edge
// adjacency to `meshGraphStore` so face detection can reuse it.
export default function useVertexSnap({ active }) {
  const indexRef = useRef([]);
  const snapIndexEpoch = useSelector(
    (s) => s.threedEditor.drawingMode.snapIndexEpoch
  );

  useEffect(() => {
    if (!active) {
      indexRef.current = [];
      clearMeshAdjacency();
      return;
    }
    const editor = getActiveThreedEditor();
    const scene = editor?.sceneManager?.scene;
    const { verts, adjacency } = buildIndex(scene);
    indexRef.current = verts;
    setMeshAdjacency(adjacency);
    return () => {
      indexRef.current = [];
      clearMeshAdjacency();
    };
  }, [active, snapIndexEpoch]);

  const findNearestSnap = useCallback(
    (mouseNdc, camera, canvasSize, pixelThreshold = 12, options = {}) => {
      const verts = indexRef.current;
      if (!verts.length || !camera || !canvasSize) return null;
      const accept = options.accept ?? null;

      const halfW = canvasSize.width / 2;
      const halfH = canvasSize.height / 2;
      const mouseX = mouseNdc.x * halfW;
      const mouseY = mouseNdc.y * halfH;

      let best = null;
      let bestSq = pixelThreshold * pixelThreshold;
      const tmp = new Vector3();
      for (const v of verts) {
        tmp.copy(v.position).project(camera);
        if (tmp.z < -1 || tmp.z > 1) continue; // behind camera or beyond far plane
        const sx = tmp.x * halfW;
        const sy = tmp.y * halfH;
        const dx = sx - mouseX;
        const dy = sy - mouseY;
        const d2 = dx * dx + dy * dy;
        if (d2 >= bestSq) continue;
        if (accept && !accept(v.position)) continue;
        bestSq = d2;
        best = v;
      }
      if (!best) return null;
      return {
        position: new Vector3(
          best.position.x,
          best.position.y,
          best.position.z
        ),
        meshKey: best.meshKey,
        nodeId: best.nodeId ?? undefined,
      };
    },
    []
  );

  const rebuildIndex = useCallback(() => {
    const editor = getActiveThreedEditor();
    const { verts, adjacency } = buildIndex(editor?.sceneManager?.scene);
    indexRef.current = verts;
    setMeshAdjacency(adjacency);
  }, []);

  return { findNearestSnap, rebuildIndex };
}
