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
//     detectClosedFace as candidate face borders so the user doesn't have
//     to redraw segments that already exist as mesh geometry
// Only FEATURE edges enter the adjacency: border edges (one triangle) and
// edges shared by non-coplanar triangles. Interior triangulation diagonals
// of a planar face (earcut artifacts, invisible to the user) are dropped —
// a cycle closing through them would commit a face cutting across existing
// faces (e.g. the fan diagonals of an L-shaped cap beating its notch path).
// Snappable = baseMap meshes (userData.isBasemap), existing annotation
// meshes (userData.nodeType === "ANNOTATION") and maille shells
// (userData.isMesh3d) — cut mailles carry vertices (cut endpoints,
// mid-edge points) that exist nowhere else. Objects hidden via an
// ancestor's `visible = false` (e.g. "Masquer les annotations") are
// skipped.
export function buildIndex(scene) {
  const verts = [];
  const adjacency = new Map(); // key -> { position, neighbors: Set<key> }
  if (!scene) return { verts, adjacency };

  function ensureNode(key, position) {
    let entry = adjacency.get(key);
    if (!entry) {
      entry = { position, neighbors: new Set() };
      adjacency.set(key, entry);
    }
    return entry;
  }

  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.visible) return;
    if (obj.userData?.isHoverOverlay) return; // transient face stipple
    let isSnappable = false;
    let parent = obj;
    while (parent) {
      if (parent.visible === false) return; // hidden by an ancestor
      if (
        parent.userData?.nodeType === "ANNOTATION" ||
        parent.userData?.isBasemap ||
        parent.userData?.isMesh3d
      ) {
        isSnappable = true;
      }
      parent = parent.parent;
    }
    if (!isSnappable) return;

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
      verts.push({ position: worldPos, meshKey });
      worldByIdx[i] = worldPos;
      const k = quantizeVertex(worldPos);
      idxToKey.set(i, k);
      ensureNode(k, worldPos);
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
        addTriangle(indexAttr.getX(i), indexAttr.getX(i + 1), indexAttr.getX(i + 2));
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
// closest snappable vertex in screen-space as `{position, meshKey}`, or null
// if none is within `pixelThreshold`. Also publishes the mesh-edge
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
    (mouseNdc, camera, canvasSize, pixelThreshold = 12) => {
      const verts = indexRef.current;
      if (!verts.length || !camera || !canvasSize) return null;

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
        if (d2 < bestSq) {
          bestSq = d2;
          best = v;
        }
      }
      if (!best) return null;
      return {
        position: new Vector3(
          best.position.x,
          best.position.y,
          best.position.z
        ),
        meshKey: best.meshKey,
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
