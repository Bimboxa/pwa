import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setNewAnnotation,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  setDrawingModeActive,
  setMeshingModeActive,
  setWalkModeActive,
} from "Features/threedEditor/threedEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import createObject3DPlacementController from "Features/threedEditor/services/object3DPlacementController";
import { selectIsBlockInstancePlacementActive } from "Features/threedEditor/utils/object3DPlacementSelectors";

import createBlockInstanceService from "../services/createBlockInstanceService";

// Heights below this (meters) are treated as "on the baseMap plane".
const MIN_OFFSET_Z_M = 0.005;
const FALLBACK_FOOTPRINT_RADIUS_M = 0.25;

// Placement of block instances in the 3D editor. Same derived mode and same
// imperative controller as the imported 3D objects
// (useObject3DPlacementHandlers): the block follows the cursor on the plane
// under it (base map or horizontal face), arrows turn it, each click drops
// one instance, Escape exits. The preview is a clone of the block's
// prototypes (BlocksManager — shared geometry).
export default function useBlockInstancePlacementHandlers() {
  const dispatch = useDispatch();

  // strings

  const nestedS =
    "Un bloc ne peut pas être inséré sur un fond de plan de blocs.";

  // data

  const active = useSelector(selectIsBlockInstancePlacementActive);
  const blockId = useSelector(
    (s) => s.annotations.newAnnotation?.instanceOfBlockId
  );
  const editorMode = useSelector((s) => s.threedEditor.editorMode);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  // values read inside the (stable-per-activation) controller callbacks
  const contextRef = useRef({});
  useEffect(() => {
    contextRef.current = { blockId, projectId, scopeId, activeLayerId };
  }, [blockId, projectId, scopeId, activeLayerId]);

  const committingRef = useRef(false);

  // effects

  useEffect(() => {
    if (!active) return undefined;

    const cancel = () => {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    };

    // The transform gizmo owns the pointer in BASEMAP_POSITION.
    if (editorMode === "BASEMAP_POSITION") {
      cancel();
      return undefined;
    }

    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!sceneManager || !dom) return undefined;

    // Placement owns the pointer — switch off competing 3D modes.
    dispatch(setDrawingModeActive(false));
    dispatch(setMeshingModeActive(false));
    dispatch(setWalkModeActive(false));

    const handleCommit = async ({
      hostBaseMap,
      xNorm,
      yNorm,
      offset,
      rotationDeg,
    }) => {
      if (committingRef.current) return;
      if (hostBaseMap?.isBlocksBaseMap) {
        dispatch(setToaster({ message: nestedS, severity: "warning" }));
        return;
      }
      const context = contextRef.current;
      committingRef.current = true;
      try {
        const instance = await createBlockInstanceService({
          blockId: context.blockId,
          baseMapId: hostBaseMap.id,
          anchor: { x: xNorm, y: yNorm },
          projectId: context.projectId,
          scopeId: context.scopeId,
          rotation: rotationDeg || 0,
          offsetZ: offset > MIN_OFFSET_Z_M ? offset : 0,
          layerId: context.activeLayerId ?? null,
        });
        if (instance) dispatch(triggerAnnotationsUpdate());
      } catch (e) {
        console.error("[BlockInstancePlacement] commit failed", e);
      } finally {
        committingRef.current = false;
      }
      // Stay in placement mode for repeated placement (Escape exits).
    };

    const blocksManager = sceneManager.blocksManager;
    const controller = createObject3DPlacementController({
      editor,
      sceneManager,
      dom,
      getObject3D: () => null,
      preview: {
        footprintRadius:
          blocksManager?.getBlockFootprintRadius(blockId) ??
          FALLBACK_FOOTPRINT_RADIUS_M,
        build: () => blocksManager?.createBlockContent(blockId) ?? null,
      },
      onCommit: handleCommit,
      onCancel: cancel,
    });

    return () => controller.dispose();
    // blockId: another block armed while active rebuilds the preview.
  }, [active, editorMode, blockId]);

  // Mutual exclusion IN: another 3D mode activating while placement is
  // active cancels the placement (same rule as useObject3DPlacementHandlers).
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const otherModeActive = drawingActive || meshingActive || walkActive;

  const prevOtherModeActiveRef = useRef(otherModeActive);
  useEffect(() => {
    const becameActive = otherModeActive && !prevOtherModeActiveRef.current;
    prevOtherModeActiveRef.current = otherModeActive;
    if (active && becameActive) {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    }
  }, [active, otherModeActive, dispatch]);
}
