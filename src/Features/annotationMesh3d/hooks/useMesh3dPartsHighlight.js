import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Group } from "three";

import {
  clearItemPartSelection,
  selectSelectedItem,
  selectSelectedPartIds,
  setSelectedPartIds,
  setSubSelection,
} from "Features/selection/selectionSlice";

import {
  MESH3D_Z_FIGHT_OFFSET,
  buildMesh3dFaceGeometry,
} from "Features/threedEditor/js/utilsAnnotationsManager/buildMesh3dAnnotationObject";
import {
  buildFaceStippleOverlay,
  buildStippleOverlayFromPositions,
} from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  MESH3D_EDGE_SELECTED_WIDTH_PX,
  MESH3D_FACE_SELECTED_STIPPLE,
  MESH3D_PART_SELECTED_COLOR,
} from "../constants/mesh3dPartColors";
import getDisplayedMesh3d, {
  getMesh3dSignature,
} from "../services/getDisplayedMesh3d";
import { mesh3dLocalToWorld } from "../services/getEditableMesh3d";
import {
  buildMesh3dEdgeLines,
  getMesh3dEdgesWorld,
} from "../services/pickMesh3dEdge";
import {
  MESH3D_FACE_PART,
  getMesh3dEdgePartId,
  getMesh3dFacePartId,
  getSelectedMesh3dParts,
} from "../utils/mesh3dPartIds";
import relocateMesh3dPartsByFootprint from "../utils/relocateMesh3dPartsByFootprint";

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  });
  object?.parent?.remove(object);
}

// Highlights the selected faces / edges of a mesh annotation in the 3D scene,
// in the "selected part" color of the 2D editor: fluo-green dots over each
// selected face (the face keeps its own color), a thick line over each
// selected edge. Both are depth-tested, so the surrounding geometry hides
// them like the mesh itself. Rebuilt when the selection changes or the
// annotation object is rebuilt.
//
// The dots are a child of the face mesh (local coordinates): they follow the
// clipping plane, the visibility and the moves of the annotation, and an
// annotation rebuild disposes them with it. The edge lines are built in world
// coordinates and added to the scene (like the vertex / edge sub-selection
// helper).
//
// A REGULAR annotation (not a mesh yet) has no face mesh: its selected parts
// address the conversion of its displayed object (getDisplayedMesh3d). The
// dots are then built from that face and added to the base map group, the
// edge lines from its vertices. Those indices only hold for that geometry:
// when the object is rebuilt with another one, the parts are re-located on
// the new conversion by their plan footprint (a vertical edit — a vertex
// offset, a height — keeps a face selected), and dropped when not found.
//
// The helpers are invisible to raycasts and to the snap index
// (userData.isHoverOverlay).
export default function useMesh3dPartsHighlight({ enabled = true } = {}) {
  const dispatch = useDispatch();
  // Signature + mesh of the displayed conversion the current parts were
  // selected on (regular annotation).
  const signatureRef = useRef(null);
  const displayedMeshRef = useRef(null);

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
    if (!enabled || !annotationId || !partsKey) {
      signatureRef.current = null;
      displayedMeshRef.current = null;
      return undefined;
    }
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
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

    const isMeshObject = Boolean(annoObject.userData?.isAnnotationMesh3d);
    const displayed = isMeshObject
      ? null
      : getDisplayedMesh3d(editor, annotationId);
    if (!isMeshObject) {
      const key = `${annotationId}|${getMesh3dSignature(displayed?.mesh)}`;
      const previous = signatureRef.current;
      const previousMesh = displayedMeshRef.current;
      signatureRef.current = key;
      displayedMeshRef.current = displayed?.mesh ?? null;
      const isStale =
        !displayed ||
        (previous?.startsWith(`${annotationId}|`) && previous !== key);
      if (isStale) {
        // Another geometry: re-locate the parts on it when possible, by
        // their plan footprint — the selection is re-dispatched and this
        // effect runs again on the new ids.
        const relocated =
          displayed && previousMesh
            ? relocateMesh3dPartsByFootprint(
                previousMesh,
                displayed.mesh,
                parts
              )
            : [];
        const relocatedKey = relocated
          .map((part) =>
            part.partType === MESH3D_FACE_PART
              ? `F${part.faceIndex}`
              : `E${part.a}_${part.b}`
          )
          .join("|");
        if (!relocated.length) {
          signatureRef.current = null;
          displayedMeshRef.current = null;
          dispatch(clearItemPartSelection(annotationId));
          return undefined;
        }
        if (relocatedKey !== partsKey) {
          const ids = relocated.map((part) =>
            part.partType === MESH3D_FACE_PART
              ? getMesh3dFacePartId(annotationId, part.faceIndex)
              : getMesh3dEdgePartId(annotationId, part.a, part.b)
          );
          dispatch(setSelectedPartIds(ids.length > 1 ? ids : []));
          dispatch(
            setSubSelection({
              partId: ids[0],
              partType: relocated[0].partType,
            })
          );
          return undefined;
        }
        // Same ids on the new geometry: draw them below.
      }
    } else {
      signatureRef.current = null;
      displayedMeshRef.current = null;
    }

    const faceOverlays = [];
    const positions = [];
    if (isMeshObject) {
      const faceMeshes = [];
      annoObject.traverse((child) => {
        if (child.isMesh && selectedFaces.has(child.userData?.mesh3dFaceIndex))
          faceMeshes.push(child);
      });
      for (const faceMesh of faceMeshes) {
        const overlay = buildFaceStippleOverlay(
          faceMesh,
          null,
          MESH3D_FACE_SELECTED_STIPPLE
        );
        if (!overlay) continue;
        faceMesh.add(overlay);
        faceOverlays.push(overlay);
      }
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
    } else {
      const { mesh, baseMapGroup } = displayed;
      for (const faceIndex of selectedFaces) {
        const face = mesh.faces[faceIndex];
        const geometry = face
          ? buildMesh3dFaceGeometry(mesh.vertices, face, MESH3D_Z_FIGHT_OFFSET)
          : null;
        if (!geometry) continue;
        const overlay = buildStippleOverlayFromPositions(
          geometry.getAttribute("position").array,
          MESH3D_FACE_SELECTED_STIPPLE
        );
        geometry.dispose();
        if (!overlay) continue;
        baseMapGroup.add(overlay);
        faceOverlays.push(overlay);
      }
      baseMapGroup.updateWorldMatrix(true, false);
      for (const token of selectedEdges) {
        const [a, b] = token.split("_").map(Number);
        const pa = mesh.vertices[a];
        const pb = mesh.vertices[b];
        if (!pa || !pb) continue;
        const wa = mesh3dLocalToWorld(pa, displayed);
        const wb = mesh3dLocalToWorld(pb, displayed);
        positions.push(wa.x, wa.y, wa.z, wb.x, wb.y, wb.z);
      }
    }

    const group = new Group();
    group.name = "Mesh3dPartsHighlight";

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
      faceOverlays.forEach(disposeObject);
      disposeObject(group);
      sceneManager.renderScene?.();
    };
  }, [enabled, annotationId, partsKey, objectTick, dispatch]);
}
