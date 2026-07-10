import { useCallback, useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  clearMeshAdjacency,
  setMeshAdjacency,
} from "../services/meshGraphStore";
import quantizeVertex from "../utils/quantizeVertex";

// Build, in a single scene traversal:
//   - a flat list of world-space mesh vertices for cursor → vertex snap
//   - a quantized adjacency map from the same meshes' triangles, used by
//     detectClosedFace as candidate face borders so the user doesn't have
//     to redraw segments that already exist as mesh geometry
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

    for (let i = 0; i < pos.count; i++) {
      tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      tmp.applyMatrix4(obj.matrixWorld);
      const worldPos = new Vector3(tmp.x, tmp.y, tmp.z);
      verts.push({ position: worldPos, meshKey });
      const k = quantizeVertex(worldPos);
      idxToKey.set(i, k);
      ensureNode(k, worldPos);
    }

    function addEdge(ia, ib) {
      const ka = idxToKey.get(ia);
      const kb = idxToKey.get(ib);
      if (!ka || !kb || ka === kb) return;
      adjacency.get(ka).neighbors.add(kb);
      adjacency.get(kb).neighbors.add(ka);
    }

    const indexAttr = geom.index;
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const a = indexAttr.getX(i);
        const b = indexAttr.getX(i + 1);
        const c = indexAttr.getX(i + 2);
        addEdge(a, b);
        addEdge(b, c);
        addEdge(c, a);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        addEdge(i, i + 1);
        addEdge(i + 1, i + 2);
        addEdge(i + 2, i);
      }
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
