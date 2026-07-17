import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  setDrawingModeActive,
  setDimensionModeActive,
  setMeshingModeActive,
  setWalkModeActive,
} from "Features/threedEditor/threedEditorSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import { getActiveThreedEditor } from "../services/threedEditorRegistry";
import createObject3DPlacementController from "../services/object3DPlacementController";
import { selectIsObject3DPlacementActive } from "../utils/object3DPlacementSelectors";

// Same fallback as getObject3DAnnotationRectanglePointsFromOnePoint (meters).
const FALLBACK_FOOTPRINT_M = 0.5;
// Heights below this (meters) are treated as "on the baseMap plane".
const MIN_OFFSET_Z_M = 0.005;

// Wires the OBJECT_3D placement mode of the 3D editor (Dessin module toggled
// to 3D). The mode is fully derived from the regular 2D drawing state set by
// the template row click in PopperMapListings (newAnnotation OBJECT_3D +
// enabledDrawingMode ONE_CLICK); the imperative controller owns the pointer,
// the preview objects and the render loop while active.
export default function useObject3DPlacementHandlers() {
  const dispatch = useDispatch();

  const active = useSelector(selectIsObject3DPlacementActive);
  const object3DFileName = useSelector(
    (s) => s.annotations.newAnnotation?.object3D?.fileName
  );
  const editorMode = useSelector((s) => s.threedEditor.editorMode);
  const renderMode = useSelector((s) => s.threedEditor.renderMode);
  const realisticShading =
    renderMode === "REALISTIC" || renderMode === "PHOTOREAL";

  const createAnnotation = useCreateAnnotation();
  const createEntity = useCreateEntity();
  const newEntity = useNewEntity();

  // Values read inside the (stable-per-activation) controller callbacks.
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const newAnnotationRef = useRef(newAnnotation);
  useEffect(() => {
    newAnnotationRef.current = newAnnotation;
  }, [newAnnotation]);

  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const activeLayerIdRef = useRef(activeLayerId);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  const newEntityRef = useRef(newEntity);
  useEffect(() => {
    newEntityRef.current = newEntity;
  }, [newEntity]);

  const committingRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    // The transform gizmo owns the pointer in BASEMAP_POSITION.
    if (editorMode === "BASEMAP_POSITION") {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      return;
    }

    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!sceneManager || !dom) return;

    // Placement owns the pointer — switch off competing 3D modes (payload
    // false is a pure switch-off in every reducer).
    dispatch(setDrawingModeActive(false));
    dispatch(setDimensionModeActive(false));
    dispatch(setMeshingModeActive(false));
    dispatch(setWalkModeActive(false));

    const handleCancel = () => {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    };

    const handleCommit = async ({ hostBaseMap, xNorm, yNorm, offset }) => {
      if (committingRef.current) return;
      const na = newAnnotationRef.current;
      // Tolerant to both BaseMap instances and plain records (same pattern
      // as worldToBaseMapNormalized). Reference frame size.
      const meterByPx = hostBaseMap.getMeterByPx?.() ?? hostBaseMap.meterByPx;
      const imageSize =
        hostBaseMap.getImageSize?.() ?? hostBaseMap.image?.imageSize;
      if (
        !na?.object3D ||
        !meterByPx ||
        !imageSize?.width ||
        !imageSize?.height
      )
        return;

      committingRef.current = true;
      try {
        const wN =
          (na.object3D.bbox?.width ?? FALLBACK_FOOTPRINT_M) /
          meterByPx /
          imageSize.width;
        const hN =
          (na.object3D.bbox?.depth ?? FALLBACK_FOOTPRINT_M) /
          meterByPx /
          imageSize.height;

        // Entity parity with the 2D commit (useHandleCommitDrawing).
        const entity = await createEntity(newEntityRef.current);

        await createAnnotation(
          {
            ...na,
            type: "OBJECT_3D",
            baseMapId: hostBaseMap.id,
            bbox: {
              x: xNorm - wN / 2,
              y: yNorm - hN / 2,
              width: wN,
              height: hN,
            },
            ...(offset > MIN_OFFSET_Z_M ? { offsetZ: offset } : {}),
            ...(activeLayerIdRef.current
              ? { layerId: activeLayerIdRef.current }
              : {}),
          },
          { entityId: entity?.id }
        );
      } catch (e) {
        console.error("[Object3DPlacement] commit failed", e);
      } finally {
        committingRef.current = false;
      }
      // Stay in placement mode for repeated placement (Escape exits).
    };

    const controller = createObject3DPlacementController({
      editor,
      sceneManager,
      dom,
      getObject3D: () => newAnnotationRef.current?.object3D,
      realisticShading,
      onCommit: handleCommit,
      onCancel: handleCancel,
    });

    return () => controller.dispose();
    // object3DFileName: a template swap while active rebuilds the preview.
  }, [active, editorMode, object3DFileName, realisticShading]);

  // Mutual exclusion IN: another 3D mode activating while placement is
  // active cancels the placement (its reducers don't know about this derived
  // mode, so watch them here).
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const dimensionActive = useSelector(
    (s) => s.threedEditor.dimensionMode.active
  );
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const otherModeActive =
    drawingActive || dimensionActive || meshingActive || walkActive;

  // Transition-guarded: at activation the effect above just switched the
  // other modes off, but this render still sees the pre-dispatch (true)
  // values — only a false → true transition while active is a takeover.
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
