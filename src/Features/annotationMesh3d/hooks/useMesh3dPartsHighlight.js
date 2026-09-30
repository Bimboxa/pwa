import { useEffect, useState } from "react";

import { useSelector } from "react-redux";
import { DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  MESH3D_EDGE_SELECTED_WIDTH_PX,
  MESH3D_PART_SELECTED_COLOR,
} from "../constants/mesh3dPartColors";
import {
  buildMesh3dEdgeLines,
  getMesh3dEdgesWorld,
} from "../services/pickMesh3dEdge";
import {
  MESH3D_FACE_PART,
  getSelectedMesh3dParts,
} from "../utils/mesh3dPartIds";

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  });
  object?.parent?.remove(object);
}

// Highlights the selected faces / edges of a mesh annotation in the 3D scene,
// in the "selected part" color of the 2D editor: a translucent skin over each
// selected face, a thick line over each selected edge. Both are depth-tested,
// so the surrounding geometry hides them like the mesh itself. Built in world
// coordinates and added to the scene (like the vertex / edge sub-selection
// helper), rebuilt when the selection changes or the annotation object is
// rebuilt.
//
// The helpers are invisible to raycasts and to the snap index
// (userData.isHoverOverlay).
export default function useMesh3dPartsHighlight({ enabled = true } = {}) {
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);

  const parts = getSelectedMesh3dParts(selectedItem, selectedPartIds);
  const annotationId = parts.length ? selectedItem.nodeId : null;
  const partsKey = parts
    .map((part) =>
      part.partType === MESH3D_FACE_PART
        ? `F${part.faceIndex}`
        : `E${part.a}_${part.b}`
    )
    .join("|");

  // Bumped when the annotation's 3D object is rebuilt.
  const [objectTick, setObjectTick] = useState(0);
  useEffect(() => {
    if (!enabled || !annotationId) return undefined;
    const manager = getActiveThreedEditor()?.sceneManager?.annotationsManager;
    return manager?.subscribeAnnotationReady?.((ids) => {
      if (ids.includes(annotationId)) setObjectTick((tick) => tick + 1);
    });
  }, [enabled, annotationId]);

  useEffect(() => {
    if (!enabled || !annotationId || !partsKey) return undefined;
    const sceneManager = getActiveThreedEditor()?.sceneManager;
    const scene = sceneManager?.scene;
    const annoObject =
      sceneManager?.annotationsManager?.annotationsObjectsMap?.[annotationId];
    if (!scene || !annoObject) return undefined;

    const selectedFaces = new Set();
    const selectedEdges = new Set();
    for (const token of partsKey.split("|")) {
      if (token[0] === "F") selectedFaces.add(Number(token.slice(1)));
      else selectedEdges.add(token.slice(1));
    }

    const group = new Group();
    group.name = "Mesh3dPartsHighlight";

    annoObject.traverse((child) => {
      if (!child.isMesh || !selectedFaces.has(child.userData?.mesh3dFaceIndex))
        return;
      child.updateWorldMatrix(true, false);
      const overlay = new Mesh(
        child.geometry.clone().applyMatrix4(child.matrixWorld),
        new MeshBasicMaterial({
          color: MESH3D_PART_SELECTED_COLOR,
          transparent: true,
          opacity: 0.45,
          side: DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        })
      );
      overlay.renderOrder = 998;
      overlay.raycast = () => {};
      overlay.userData.isHoverOverlay = true;
      group.add(overlay);
    });

    const positions = [];
    for (const edge of getMesh3dEdgesWorld(annoObject)) {
      const [lo, hi] = edge.a < edge.b ? [edge.a, edge.b] : [edge.b, edge.a];
      if (!selectedEdges.has(`${lo}_${hi}`)) continue;
      positions.push(
        edge.pa.x,
        edge.pa.y,
        edge.pa.z,
        edge.pb.x,
        edge.pb.y,
        edge.pb.z
      );
    }
    if (positions.length) {
      group.add(
        buildMesh3dEdgeLines(positions, {
          color: MESH3D_PART_SELECTED_COLOR,
          linewidth: MESH3D_EDGE_SELECTED_WIDTH_PX,
          domElement: sceneManager.renderer?.domElement,
        })
      );
    }

    scene.add(group);
    sceneManager.renderScene?.();
    return () => {
      disposeObject(group);
      sceneManager.renderScene?.();
    };
  }, [enabled, annotationId, partsKey, objectTick]);
}
