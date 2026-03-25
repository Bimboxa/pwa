// components/InteractionLayer.jsx
import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useDispatch, useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';

import { useInteraction } from '../context/InteractionContext';

import { setSelectedEntityId } from 'Features/entities/entitiesSlice';
import { setEnabledDrawingMode, setSelectedNodes, setMapEditorMode } from 'Features/mapEditor/mapEditorSlice';
import { setSelectedNode, toggleSelectedNode } from 'Features/mapEditor/mapEditorSlice';
import { setAnnotationToolbarPosition, setAnnotationsToolbarPosition } from 'Features/mapEditor/mapEditorSlice';
import { setAnchorSourceAnnotationId, setOrthoSnapEnabled } from 'Features/mapEditor/mapEditorSlice';
import { setSelectedVersionId } from 'Features/baseMapEditor/baseMapEditorSlice';
import { setOpenDialogDeleteSelectedAnnotation, setTempAnnotations, setNewAnnotation, triggerAnnotationsUpdate } from 'Features/annotations/annotationsSlice';
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import {
  setSelectedItem,
  setSelectedItems,
  toggleItemSelection,
  setSubSelection,
  clearSelection,
  selectSelectedItems,
  selectSelectedPointId,
  selectSelectedPartId,
  setShowAnnotationsProperties
} from "Features/selection/selectionSlice";

import useResetNewAnnotation from 'Features/annotations/hooks/useResetNewAnnotation';
import useLassoSelection from 'Features/mapEditorGeneric/hooks/useLassoSelection';
import useSelectedNodes from 'Features/mapEditor/hooks/useSelectedNodes';
import useAnnotationPermissions from 'Features/mapEditor/hooks/useAnnotationPermissions';
import usePointDrag from 'Features/mapEditor/hooks/usePointDrag';
import useAnnotationDrag from 'Features/mapEditor/hooks/useAnnotationDrag';
import useDrawingCommit from 'Features/mapEditor/hooks/useDrawingCommit';
import useSaveTempAnnotations from 'Features/mapEditor/hooks/useSaveTempAnnotations';
import useBaseMapDrag from 'Features/mapEditor/hooks/useBaseMapDrag';
import useVersionDrag from 'Features/mapEditor/hooks/useVersionDrag';
import useCalibrationDrag from 'Features/mapEditor/hooks/useCalibrationDrag';
import useLegendDrag from 'Features/mapEditor/hooks/useLegendDrag';

import Box from '@mui/material/Box';
import MapEditorViewport from 'Features/mapEditorGeneric/components/MapEditorViewport';
import DrawingLayer from 'Features/mapEditorGeneric/components/DrawingLayer';
import BrushDrawingLayer from 'Features/mapEditorGeneric/components/BrushDrawingLayer';
import ScreenCursorV2 from 'Features/mapEditorGeneric/components/ScreenCursorV2';
import SnappingLayer from 'Features/mapEditorGeneric/components/SnappingLayer';
import TransientTopologyLayer from 'Features/mapEditorGeneric/components/TransientTopologyLayer';
import TransientAnnotationLayer from 'Features/mapEditorGeneric/components/TransientAnnotationLayer';
import DropZoneLayer from 'Features/mapEditorGeneric/components/DropZoneLayer';

import TransientDetectedShapeLayer from 'Features/mapEditorGeneric/components/TransientDetectedShapeLayer';
import computeWrapperBbox from '../utils/computeWrapperBbox';
import anchorAnnotationToTarget from 'Features/annotations/services/anchorAnnotationToTarget';
import AnnotationEditingWrapper from './AnnotationEditingWrapper';
import applyDeltaPosToAnnotation from 'Features/mapEditorGeneric/utils/applyDeltaPosToAnnotation';

import ClosingMarker from 'Features/mapEditorGeneric/components/ClosingMarker';
import HelperScale from 'Features/mapEditorGeneric/components/HelperScale';
import MapTooltip from 'Features/mapEditorGeneric/components/MapTooltip';
import SmartDetectLayer from 'Features/mapEditorGeneric/components/SmartDetectLayer';
import TransientOrthoPathsLayer from 'Features/mapEditorGeneric/components/TransientOrthoPathsLayer';
import TransientDetectedPolylinesLayer from 'Features/mapEditorGeneric/components/TransientDetectedPolylinesLayer';
import TransientDetectedPolygonLayer from 'Features/mapEditorGeneric/components/TransientDetectedPolygonLayer';
import detectPolygonFromAnnotations from 'Features/smartDetect/utils/detectPolygonFromAnnotations';
import throttle from 'Features/misc/utils/throttle';
import SmartTransformerLayer from 'Features/transformers/components/SmartTransformerLayer';
import CalibrationLayer from './CalibrationLayer';
import useMainBaseMap from 'Features/mapEditor/hooks/useMainBaseMap';
import LassoOverlay from 'Features/mapEditorGeneric/components/LassoOverlay';
import DialogAutoLoadingModel from 'Features/transformers/components/DialogAutoLoadingModel';


import mergeBboxes from 'Features/misc/utils/mergeBboxes';
import snapToAngle from 'Features/mapEditor/utils/snapToAngle';
import getBestSnap from 'Features/mapEditor/utils/getBestSnap';
import getSnapModes from 'Features/mapEditor/utils/getSnapModes';
import getAnnotationEditionPanelAnchor from 'Features/annotations/utils/getAnnotationEditionPanelAnchor';
import getAnnotationLabelPropsFromAnnotation from 'Features/annotations/utils/getAnnotationLabelPropsFromAnnotation';
import toggleSelectedNodeFunction from '../utils/toggleSelectedNode';

import { setToaster } from "Features/layout/layoutSlice";
import db from "App/db/db";
import cv from "Features/opencv/services/opencvService";
import editor from "App/editor";
import getTopMiddlePoint from 'Features/geometry/utils/getTopMiddlePoint';

import getAnnotationBBox from 'Features/annotations/utils/getAnnotationBbox';
import orthogonalizePolyline from 'Features/geometry/utils/orthogonalizePolyline';
import alignPolygonsToGrid from 'Features/geometry/utils/alignPolygonsToGrid';

import { useSmartZoom } from "App/contexts/SmartZoomContext";
import useUndo from "App/db/useUndo";

// constants

const SNAP_THRESHOLD_ABSOLUTE = 12;
const DRAG_THRESHOLD_PX = 3; // Seuil de déplacement pour activer le drag
const SCREEN_BRUSH_RADIUS_PX = 12; // Rayon fixe à l'écran
const LOUPE_SIZE = 200; // Taille écran de la loupe
const SMART_ZOOM = 3.0; // Facteur de grossissement
const MAX_FAILURES = 0; // On autorise 1 frames d'échec avant de stopper le autopan
import mergeDetectedPolyIntoDrawing from 'Features/smartDetect/utils/mergeDetectedPolyIntoDrawing';

const PAN_STEP = 30;


const InteractionLayer = forwardRef(({
  children,
  isActiveViewer = true,
  enabledDrawingMode,
  newAnnotation,
  onCommitDrawing,
  onCommitSplitAtVertex,
  onCommitPointsFromSurfaceDrop,
  onCommitImageDrop,
  basePose,
  onBaseMapPoseChange,
  onBaseMapPoseCommit,
  baseMapImageSize,
  baseMapImageScale,
  baseMapImageOffset,
  baseMapImageUrl,
  baseMapMainAngleInDeg,
  bgPose = { x: 0, y: 0, k: 1 },
  activeContext = "BASE_MAP",
  annotations, // <= snapping source.
  onPointMoveCommit,
  onPointSnapReplace,
  onToggleAnnotationPointType,
  onPointDuplicateAndMoveCommit,
  onDeletePoint,
  onHideSegment,
  onRemoveCut,
  onAnnotationMoveCommit,
  onSegmentSplit,
  onCutSegment,
  onTechnicalReturn,
  onSplitPolylineClick,
  onSplitPolylineEnter,
  onSplitPolylineReset,
  onSplitPolylineClickPoint,
  onProjectionSnapInsert,
  snappingEnabled = true,
  // selectedNode, // Removed prop usage, use Redux
  // selectedNodes, // Removed prop usage
  baseMapMeterByPx,
  showBgImage,
  legendFormat,
  onLegendFormatChange,
  transformersWorker,
}
  , ref) => {
  const dispatch = useDispatch();



  // refs

  const viewportRef = useRef(null); // Ref vers la caméra
  const drawingLayerRef = useRef(null);
  const lastPreviewPosRef = useRef(null);
  const brushLayerRef = useRef(null);
  const screenCursorRef = useRef(null);
  const snappingLayerRef = useRef(null);
  const closingMarkerRef = useRef(null);
  const helperScaleRef = useRef(null);
  // baseMapRafRef — now managed by useBaseMapDrag
  const smartDetectRef = useRef(null); // <--- REF VERS LA LOUPE
  const smartTransformerRef = useRef(null);
  const transientOrthoPathsRef = useRef(null);
  const detectedOrthoPathsRef = useRef(null); // current ortho detection results (image coords)
  const committedOrthoSegmentsRef = useRef([]); // accumulated committed segments for exclusion
  const transientDetectedPolygonRef = useRef(null);
  const detectedPolygonRef = useRef(null); // current polygon detection result { outerRing, cuts }
  const transientDetectedPolylinesRef = useRef(null);
  const detectedSimilarPolylinesRef = useRef(null); // {imageCoords, localCoords}
  const cachedDetectImageUrlRef = useRef(null);
  const lastSmartROI = useRef(null); // pour la reconversion inverse Loupe => World.
  const lastMouseScreenPosRef = useRef({
    screenPos: { x: 0, y: 0 },
    viewportPos: { x: 0, y: 0 }
  });
  const autoPanRef = useRef({
    active: false,
    direction: null,
    consecutiveFailures: 0
  });
  const autoPanCounter = useRef(0);
  const autoPanSessionRef = useRef(0);
  const commitPendingRef = useRef(null); // annotationId en attente de convergence DB


  // context

  const { setHoveredNode,
    setHiddenAnnotationIds,
    // setSelectedPointId, selectedPointId, // REMOVED
    // setSelectedPartId, selectedPartId, // REMOVED
    pendingMovesRef,
    setPendingMovesVersion,
    getPendingMove,
    setBasePose } = useInteraction();

  // Selection from Redux
  const selectedItems = useSelector(selectSelectedItems);
  const selectedPointId = useSelector(selectSelectedPointId);
  const selectedPartId = useSelector(selectSelectedPartId);

  // Computed selectedNode equivalent (first item)
  const { node: selectedNode } = useSelectedNodes();

  // Anchor snap mode
  const anchorSourceAnnotationId = useSelector((s) => s.mapEditor.anchorSourceAnnotationId);
  const mapEditorMode = useSelector((s) => s.mapEditor.mapEditorMode);
  const orthoSnapEnabled = useSelector((s) => s.mapEditor.orthoSnapEnabled);
  const orthoSnapAngleOffset = useSelector((s) => s.mapEditor.orthoSnapAngleOffset);
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const { zoomContainer } = useSmartZoom();

  // permissions (ownership-based)
  const permissions = useAnnotationPermissions({ annotations });

  // undo / redo (CTRL-Z / CTRL-SHIFT-Z)
  useUndo();

  // throttled polygon detection from annotations
  const runPolygonDetection = useMemo(() => throttle((localMousePos, currentAnnotations, currentDrawingPoints) => {
    const result = detectPolygonFromAnnotations({
      annotations: currentAnnotations,
      drawingPoints: currentDrawingPoints,
      mousePos: localMousePos,
      tolerance: 5,
    });
    detectedPolygonRef.current = result;
    if (result) {
      transientDetectedPolygonRef.current?.updatePolygon(result);
    } else {
      transientDetectedPolygonRef.current?.clear();
    }
  }, 120), []);

  // sourceImage for smart detect

  const [sourceImageEl, setSourceImageEl] = useState(null);

  // baseMap - rotation

  let rotation = 0;
  if (baseMapMainAngleInDeg) {
    let angle = baseMapMainAngleInDeg;
    if (typeof angle === "string") angle = parseFloat(angle.replace(",", "."));
    if (!isNaN(angle)) rotation = angle * Math.PI / 180;
  };

  // expose handlers

  useImperativeHandle(ref, () => ({
    setCameraMatrix: (cameraMatrix) => {
      if (viewportRef.current) {
        viewportRef.current.setCameraMatrix(cameraMatrix);
      }
    },
  }));

  // newAnnotation

  const resetNewAnnotation = useResetNewAnnotation();

  // selectedAnnotation

  const selectedAnnotationRef = useRef(null);

  const selectedAnnotation = useMemo(() => {
    if (selectedNode?.nodeId?.startsWith("label::")) {
      const annotationId = selectedNode?.nodeId.replace("label::", "");
      selectedAnnotationRef.current = getAnnotationLabelPropsFromAnnotation(annotations?.find((annotation) => annotation.id === annotationId));
      return selectedAnnotationRef.current;
    } else {
      selectedAnnotationRef.current = annotations?.find((annotation) => annotation.id === selectedNode?.nodeId);
      return selectedAnnotationRef.current;
    }
  }, [annotations, selectedNode?.nodeId]);

  // annotations for Snap
  // When in point-editing mode, allow snapping to all annotations
  // Only restrict to selected annotation when actively drawing or moving the whole annotation

  let annotationsForSnap = annotations;
  if (selectedAnnotation?.id && !selectedPointId && !selectedPartId) {
    annotationsForSnap = [selectedAnnotation];
  }

  // cameraZoom

  const cameraZoom = viewportRef.current?.getZoom() || 1;

  // Transient detected line
  const previewLineLayerRef = useRef(null);
  const transientDetectedCornerLayerRef = useRef(null);
  const transientDetectedShapeLayerRef = useRef(null);
  const smartCornerRef = useRef(null);
  const detectedShapeRef = useRef(null);


  const handleSmartShapeDetected = (shape) => {
    // shape: { type: 'POINT'|'LINE'|'RECTANGLE', points: [] } ou null
    // In DETECT_SIMILAR_POLYLINES mode, don't show preview on the map
    if (enabledDrawingModeRef.current === "DETECT_SIMILAR_POLYLINES") return;

    detectedShapeRef.current = shape;

    if (transientDetectedShapeLayerRef.current) {
      transientDetectedShapeLayerRef.current.updateShape(shape);
    }

    // Pour le "space", on stocke dans detectedShapeRef.
    // Pour le corner, on gardait smartCornerRef pour le snap...
    // SI le user demande de tout unifier, on unifie le storage.

    // Feedback visuel DONE par le layer.
  };

  // Legacy handlers placeholders if references exist elsewhere (can be removed if safe)
  // const handleSmartLineDetected = () => {};
  // const handleCornerDetected = () => {};


  // update helper scale

  function handleCameraChange(cameraMatrix) {
    helperScaleRef.current?.updateZoom(cameraMatrix.k);

    // pour MAJ de l'image affichée dans la smart detect
    if (enabledDrawingModeRef.current === "SMART_DETECT" || showSmartDetectRef.current) {
      updateSmartDetect(lastMouseScreenPosRef.current);
    }

    // 2. Update Viewport Bounds in BaseMap Reference
    // On demande la taille directement au viewportRef
    const size = viewportRef.current?.getViewportSize();

    if (size && size.width > 0 && size.height > 0) {
      const { width: w, height: h } = size;

      // A. Screen -> World (Standard Viewport Math)
      // World = (Screen - CameraTrans) / CameraScale
      const worldLeft = (0 - cameraMatrix.x) / cameraMatrix.k;
      const worldTop = (0 - cameraMatrix.y) / cameraMatrix.k;
      const worldRight = (w - cameraMatrix.x) / cameraMatrix.k;
      const worldBottom = (h - cameraMatrix.y) / cameraMatrix.k;

      // B. World -> Local BaseMap (Inverse Transform)
      // Local = (World - BasePose) / BaseScale
      const pose = getTargetPose();

      // Sécurité pour éviter division par zéro
      const baseK = pose.k || 1;

      const localLeft = (worldLeft - pose.x) / baseK;
      const localTop = (worldTop - pose.y) / baseK;
      const localRight = (worldRight - pose.x) / baseK;
      const localBottom = (worldBottom - pose.y) / baseK;

      const bounds = {
        x: localLeft,
        y: localTop,
        width: localRight - localLeft,
        height: localBottom - localTop
      };

      // Mise à jour de l'objet global editor pour le service OpenCV
      if (editor) {
        editor.viewportInBase = { bounds };
      }
    }

  }

  // tooltip

  const [tooltipData, setTooltipData] = useState(null);
  const tooltipRef = useRef(null);

  // target pose & scale

  const basePoseRef = useRef(basePose);
  useEffect(() => {
    basePoseRef.current = basePose;
    setBasePose(basePose);
  }, [basePose]);

  // Convergence DB : on attend que l'annotation ait réellement changé dans annotations[]
  // commitSnapshotRef stocke un snapshot léger de l'annotation avant le drag
  // On compare avec les données courantes pour détecter la convergence
  // Convergence DB — now managed by useAnnotationDrag (see above)

  const getTargetPose = () => {
    if (activeContext === "BG_IMAGE") return { x: 0, y: 0, k: 1 };
    return basePoseRef.current || { x: 0, y: 0, k: 1 };
  };
  const getTargetScale = () => {
    return getTargetPose()?.k || 1;
  };
  // 2. Helper: World (Screen-Camera) -> Local (Image)
  const toLocalCoords = (worldPos) => {
    const pose = getTargetPose();
    // Reverse the transform: Local = (World - Translate) / Scale
    // Note: This assumes rotation is 0 for simplicity. 
    // If rotation exists, you need the matrixHelpers functions.
    return {
      x: (worldPos.x - pose.x) / pose.k,
      y: (worldPos.y - pose.y) / pose.k
    };
  };


  // Reset logic is now handled by Redux updates.


  // updateSmartDetect

  // Drawing modes that only select existing geometry (no smart detect needed)
  const SEGMENT_SELECT_MODES = ["TECHNICAL_RETURN", "CUT_SEGMENT"];
  const NO_SMART_DETECT_MODES = [...SEGMENT_SELECT_MODES, "SPLIT_POLYLINE", "SPLIT_POLYLINE_CLICK"];

  const [showSmartDetect, setShowSmartDetect] = useState(false);
  const showSmartDetectRef = useRef(showSmartDetect);
  useEffect(() => {
    const show = Boolean(enabledDrawingMode) && !NO_SMART_DETECT_MODES.includes(enabledDrawingMode);
    //showSmartDetectRef.current = showSmartDetect;
    showSmartDetectRef.current = show;
  }, [showSmartDetect, enabledDrawingMode])



  const updateSmartDetect = useCallback((positions) => {
    if (!positions) return;
    const { screenPos, viewportPos } = positions;

    // A. LOGIQUE : Calculer la position MONDE à partir de l'écran GLOBAL
    // screenToWorld attend clientX/clientY
    const worldPos = viewportRef.current?.screenToWorld(screenPos.x, screenPos.y);
    if (!worldPos) return;

    const targetPose = getTargetPose();
    const currentCameraZoom = viewportRef.current?.getZoom() || 1;
    const totalScale = (targetPose.k || 1) * currentCameraZoom;

    const sourceWidthInImage = (LOUPE_SIZE / SMART_ZOOM) / totalScale;
    const sourceHeightInImage = (LOUPE_SIZE / SMART_ZOOM) / totalScale;

    const localPos = toLocalCoords(worldPos);

    const sourceROI = {
      x: (localPos.x - sourceWidthInImage / 2 - baseMapImageOffset.x) / baseMapImageScale,
      y: (localPos.y - sourceHeightInImage / 2 - baseMapImageOffset.y) / baseMapImageScale,
      width: sourceWidthInImage / baseMapImageScale,
      height: sourceHeightInImage / baseMapImageScale
    };

    // B. VISUEL : Positionner la loupe avec les coordonnées LOCALES (viewportPos)
    // car le composant SmartDetectLayer est rendu en 'absolute' dans cette Box
    if (smartDetectRef.current) {
      // In POLYGON_CLICK mode, only update the loupe visual (no OpenCV analysis)
      // In POLYLINE_CLICK/STRIP mode without advancedLayout, also skip analysis (loupe only)
      const smartModes = ["POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "RECTANGLE", "SMART_DETECT", "DETECT_SIMILAR_POLYLINES"];
      const skipAnalysis = !smartModes.includes(enabledDrawingModeRef.current);
      smartDetectRef.current.update(viewportPos, sourceROI, { skipAnalysis });
    }

    lastSmartROI.current = { ...sourceROI, zoomFactor: SMART_ZOOM, totalScale };
  }, [toLocalCoords, getTargetPose, baseMapImageScale]);


  // Smart Transformer

  const updateSmartTransformer = useCallback((positions) => {

    if (!positions) return;

    // On récupère les positions souris stockées (screenPos = clientX/Y, viewportPos = relatif conteneur)
    const { screenPos, viewportPos } = positions;

    // 1. Calculer la position souris dans le monde (World) puis dans l'image (Local)
    const worldPos = viewportRef.current?.screenToWorld(screenPos.x, screenPos.y);
    if (!worldPos) return;

    const localPos = toLocalCoords(worldPos);

    // 2. Calculer le Zoom Total (Échelle Image * Zoom Caméra)
    const baseK = getTargetPose()?.k || 1;
    const cameraZoom = viewportRef.current?.getZoom() || 1;
    const totalScale = baseK * cameraZoom;

    // 3. Mettre à jour le Transformer Layer
    // Il affichera un carré de (512 * totalScale) pixels à l'écran
    if (smartTransformerRef.current) {
      smartTransformerRef.current.update(viewportPos, localPos, totalScale);
    }

    // (Optionnel) Si vous avez besoin de stocker le ROI pour d'autres calculs,
    // notez que le ROI est maintenant implicitement :
    // x: localPos.x - 256, y: localPos.y - 256, w: 512, h: 512
  }, [toLocalCoords, getTargetPose]);


  // Lasso selection
  function handleLassoSelection({ annotationIds, selectionBox, anchorPosition }) {
    console.log("lasso selection", annotationIds, selectionBox);
    const newItems = annotationIds.map(id => {
      const ann = annotations.find(a => a.id === id);
      return {
        id: id,
        nodeId: id,
        type: 'NODE',
        nodeType: ann?.type,
        entityId: ann?.entityId,
        listingId: ann?.listingId,
        pointId: null,
        partId: null,
        partType: null
      };
    });
    dispatch(setSelectedItems(newItems));
    dispatch(setAnnotationsToolbarPosition(anchorPosition))
  }

  const { lassoRect, startLasso, updateLasso, endLasso } = useLassoSelection({
    annotations,
    viewportRef,
    toLocalCoords,
    onSelectionComplete: handleLassoSelection
  });

  const currentSnapRef = useRef(null); // Stocke le résultat du getBestSnap

  // drag state — point drag (extracted to usePointDrag)

  const {
    dragState,
    dragStateRef,
    virtualInsertion,
    pointInsertedAt,
    handleVertexOrProjectionMouseDown,
    handlePointDragMove,
    handlePointDragEnd,
  } = usePointDrag({
    annotations,
    selectedNode,
    selectedAnnotationRef,
    toLocalCoords,
    permissions,
    setHiddenAnnotationIds,
    onPointMoveCommit,
    onPointSnapReplace,
    onPointDuplicateAndMoveCommit,
    onSegmentSplit,
    onToggleAnnotationPointType,
    onProjectionSnapInsert,
    currentSnapRef,
    viewportRef,
    dispatch,
  });

  // Pulse animation when a point is inserted via click on snap helper
  useEffect(() => {
    if (pointInsertedAt) {
      const pose = getTargetPose();
      const worldX = pointInsertedAt.x * pose.k + pose.x;
      const worldY = pointInsertedAt.y * pose.k + pose.y;
      const screenPos = viewportRef.current?.worldToViewport(worldX, worldY);
      if (screenPos) {
        snappingLayerRef.current?.triggerPulse(screenPos.x, screenPos.y);
      }
    }
  }, [pointInsertedAt]);

  // drag state — annotation drag (extracted to useAnnotationDrag)

  const {
    dragAnnotationState,
    dragAnnotationStateRef,
    initAnnotationDrag,
    handleAnnotationDragMove,
    handleAnnotationDragEnd,
  } = useAnnotationDrag({
    annotations,
    permissions,
    toLocalCoords,
    viewportRef,
    pendingMovesRef,
    setPendingMovesVersion,
    commitPendingRef,
    onAnnotationMoveCommit,
  });

  // drag state — basemap drag (extracted to useBaseMapDrag)

  const {
    dragBaseMapState,
    initBaseMapDrag,
    handleBaseMapDragMove,
    handleBaseMapDragEnd,
  } = useBaseMapDrag({
    basePose,
    baseMapImageSize,
    bgPose,
    onBaseMapPoseChange,
    onBaseMapPoseCommit,
    viewportRef,
  });

  // drag state — version drag (extracted to useVersionDrag)

  const {
    versionDragState,
    versionTransformOverride,
    initVersionDrag,
    handleVersionDragMove,
    handleVersionDragEnd,
  } = useVersionDrag({
    basePose,
    viewportRef,
  });

  // drag state — calibration targets

  const calibrationBaseMap = useMainBaseMap();
  const {
    calibrationDragState,
    initCalibrationDrag,
    handleCalibrationDragMove,
    handleCalibrationDragEnd,
  } = useCalibrationDrag({
    basePose,
    viewportRef,
    baseMap: calibrationBaseMap,
  });

  // drag state — legend drag (extracted to useLegendDrag)

  const {
    dragLegendState,
    initLegendDrag,
    handleLegendDragMove,
    handleLegendDragEnd,
  } = useLegendDrag({
    bgPose,
    legendFormat,
    onLegendFormatChange,
    viewportRef,
  });

  const [dragTextState, setDragTextState] = useState(null);
  // { active: true, handleType: 'MOVE'|'SE'..., startMouseScreen: {x,y}, startText }

  // Split flash effect — transient circle at the split point
  const [splitFlashPoint, setSplitFlashPoint] = useState(null);
  useEffect(() => {
    if (!splitFlashPoint) return;
    const timer = setTimeout(() => setSplitFlashPoint(null), 600);
    return () => clearTimeout(timer);
  }, [splitFlashPoint]);

  // virtual insertion — now managed by usePointDrag (see above)

  // is closing
  const isClosingRef = useRef(false);

  // handleHoverFirstPoint / handleLeaveFirstPoint — replaced by screen-distance
  // check in handleWorldMouseMove (section F. CLOSING DETECTION)


  // syncRef

  const isActiveViewerRef = useRef(isActiveViewer);
  useEffect(() => {
    isActiveViewerRef.current = isActiveViewer;
  }, [isActiveViewer]);

  const enabledDrawingModeRef = useRef(enabledDrawingMode);
  useEffect(() => {
    enabledDrawingModeRef.current = enabledDrawingMode;
  }, [enabledDrawingMode]);

  const newAnnotationRef = useRef(newAnnotation);
  useEffect(() => {
    newAnnotationRef.current = newAnnotation;
  }, [newAnnotation]);

  const mapEditorModeRef = useRef(mapEditorMode);
  useEffect(() => {
    mapEditorModeRef.current = mapEditorMode;
  }, [mapEditorMode]);

  const anchorSourceAnnotationIdRef = useRef(anchorSourceAnnotationId);
  useEffect(() => {
    anchorSourceAnnotationIdRef.current = anchorSourceAnnotationId;
  }, [anchorSourceAnnotationId]);

  const orthoSnapEnabledRef = useRef(orthoSnapEnabled);
  useEffect(() => {
    orthoSnapEnabledRef.current = orthoSnapEnabled;
  }, [orthoSnapEnabled]);

  const orthoSnapAngleOffsetRef = useRef(orthoSnapAngleOffset);
  useEffect(() => {
    orthoSnapAngleOffsetRef.current = orthoSnapAngleOffset;
  }, [orthoSnapAngleOffset]);

  const onCommitDrawingRef = useRef(onCommitDrawing);
  useEffect(() => {
    onCommitDrawingRef.current = onCommitDrawing;
  }, [onCommitDrawing]);

  const onCommitSplitAtVertexRef = useRef(onCommitSplitAtVertex);
  useEffect(() => {
    onCommitSplitAtVertexRef.current = onCommitSplitAtVertex;
  }, [onCommitSplitAtVertex]);

  const onSplitPolylineClickRef = useRef(onSplitPolylineClick);
  useEffect(() => {
    onSplitPolylineClickRef.current = onSplitPolylineClick;
  }, [onSplitPolylineClick]);

  const onSplitPolylineEnterRef = useRef(onSplitPolylineEnter);
  useEffect(() => {
    onSplitPolylineEnterRef.current = onSplitPolylineEnter;
  }, [onSplitPolylineEnter]);

  const onSplitPolylineResetRef = useRef(onSplitPolylineReset);
  useEffect(() => {
    onSplitPolylineResetRef.current = onSplitPolylineReset;
  }, [onSplitPolylineReset]);

  const onSplitPolylineClickPointRef = useRef(onSplitPolylineClickPoint);
  useEffect(() => {
    onSplitPolylineClickPointRef.current = onSplitPolylineClickPoint;
  }, [onSplitPolylineClickPoint]);

  // drawing state + commit (extracted to useDrawingCommit)

  const {
    drawingPoints, setDrawingPoints, drawingPointsRef,
    cutHostId, setCutHostId,
    brushPath, setBrushPath,
    commitPoint, commitPolyline,
  } = useDrawingCommit({
    enabledDrawingModeRef,
    onCommitDrawingRef,
    brushLayerRef,
    smartDetectRef,
    lastSmartROI,
  });

  const saveTempAnnotations = useSaveTempAnnotations();

  const stateRef = useRef({
    selectedNode,
    selectedPointId,
    selectedPartId,
    enabledDrawingMode: enabledDrawingMode, // Si besoin dans le listener
    onDeletePoint,
    onHideSegment,
    onRemoveCut,
    permissions,
  });
  useEffect(() => {
    stateRef.current = {
      selectedNode,
      selectedPointId,
      selectedPartId,
      onDeletePoint,
      onHideSegment,
      onRemoveCut,
      enabledDrawingMode,
      permissions,
    };
  }, [selectedNode?.nodeId, selectedPointId, selectedPartId, onDeletePoint, onHideSegment, onRemoveCut, enabledDrawingMode, permissions]);


  // 1. Calculer le style curseur du conteneur
  const getCursorStyle = () => {
    if (dragState?.active) return 'crosshair';
    if (SEGMENT_SELECT_MODES.includes(enabledDrawingMode)) return 'pointer';
    if (enabledDrawingMode) return 'crosshair'; // Priorité 1           // Priorité 2
    return 'default';                           // Défaut
  };

  // commitPoint + commitPolyline — now provided by useDrawingCommit (see above)



  // AUTO SPAN
  const stopAutoPan = useCallback((reason = "USER_STOP") => {
    if (autoPanRef.current.active) {
      console.warn(`[AUTOPAN step stop] STOPPING. Reason: "${reason}". Total steps: ${autoPanCounter.current}`);
    }
    autoPanRef.current.active = false;
    autoPanRef.current.consecutiveFailures = 0;
    autoPanCounter.current = 0;
  }, []);

  const startAutoPan = useCallback(async (directionKey) => {
    // 1. Initialisation
    console.log(`[AUTOPAN] Starting sequence for ${directionKey}`);

    const sessionId = ++autoPanSessionRef.current;

    if (autoPanRef.current.active && autoPanRef.current.direction === directionKey) return;

    autoPanRef.current = { active: true, direction: directionKey, consecutiveFailures: 0 };
    autoPanCounter.current = 0;

    const step = async () => {
      try {
        // 2. Vérification Vitalité
        if (autoPanSessionRef.current !== sessionId) return;
        if (!autoPanRef.current.active) return;

        autoPanCounter.current += 1;

        // 3. Analyse (Async)
        let orientation = null;
        try {
          orientation = await smartDetectRef.current?.detectOrientationNow();
        } catch (err) {
          console.error("AutoPan CV Error:", err);
        }

        if (autoPanSessionRef.current !== sessionId || !autoPanRef.current.active) return;

        // 4. Décision d'alignement
        let isAligned = false;
        let mismatchReason = "";

        if (!orientation) {
          mismatchReason = "NO_LINE";
        } else {
          // Logique H / V
          if (orientation === 'H' && (directionKey === 'ArrowLeft' || directionKey === 'ArrowRight')) {
            isAligned = true;
          }
          else if (orientation === 'V' && (directionKey === 'ArrowUp' || directionKey === 'ArrowDown')) {
            isAligned = true;
          }
          // Logique ANGLE
          else if (orientation === 'ANGLE') {
            // Un angle n'est jamais "aligné" pour le mode auto, car on doit s'arrêter ou décider.
            isAligned = false;
            mismatchReason = "ANGLE_DETECTED";
          }
          else {
            mismatchReason = `MISMATCH (Dir:${directionKey} vs Line:${orientation})`;
          }
        }

        // 5. Calcul du vecteur de déplacement
        const PAN_STEP = 30; // Ou votre constante globale
        let dx = 0, dy = 0;

        if (directionKey === 'ArrowLeft') dx = PAN_STEP;
        if (directionKey === 'ArrowRight') dx = -PAN_STEP;
        if (directionKey === 'ArrowUp') dy = PAN_STEP;
        if (directionKey === 'ArrowDown') dy = -PAN_STEP;


        // --- BRANCHEMENT LOGIQUE ---

        if (isAligned) {
          // CAS A : SUCCÈS -> Mode Auto (Boucle)
          // ------------------------------------
          autoPanRef.current.consecutiveFailures = 0;

          viewportRef.current?.panBy(dx, dy);
          refreshLoupePosition();

          setTimeout(step, 60);
        }
        else if (
          autoPanCounter.current === 1 &&
          (mismatchReason === "NO_LINE" || mismatchReason === "ANGLE_DETECTED")
        ) {
          // CAS B : DÉMARRAGE MANUEL (Force un pas)
          // ---------------------------------------
          // Uniquement au premier tick (counter === 1).
          // Permet de démarrer dans le vide OU de sortir d'un angle.
          console.log(`[AutoPan] Manual Start Triggered: ${mismatchReason}`);

          viewportRef.current?.panBy(dx, dy);
          refreshLoupePosition();

          stopAutoPan("FALLBACK_MANUAL");
        }
        else if (mismatchReason === "ANGLE_DETECTED") {
          // CAS C : ARRÊT SUR OBSTACLE (Angle rencontré en route)
          // -----------------------------------------------------
          // Ici counter > 1. On vient de tomber sur un angle.
          // On s'arrête IMMÉDIATEMENT sans faire de panBy supplémentaire.
          console.log("[AutoPan] Angle detected during run -> Immediate Stop");
          stopAutoPan("ANGLE_HIT");
        }
        else {
          // CAS D : ECHEC / PERTE DE LIGNE (En cours de route)
          // --------------------------------------------------
          // Gestion de la tolérance pour les micro-coupures de détection
          autoPanRef.current.consecutiveFailures += 1;

          if (autoPanRef.current.consecutiveFailures < MAX_FAILURES) {
            console.log(`[AutoPan] Retry ${autoPanRef.current.consecutiveFailures}/${MAX_FAILURES}`);
            setTimeout(step, 100);
          } else {
            stopAutoPan(mismatchReason);
          }
        }

      } catch (e) {
        console.error("AutoPan Critical Error:", e);
        stopAutoPan("ERROR");
      }
    };

    // Helper interne
    const refreshLoupePosition = () => {
      let pos = lastMouseScreenPosRef.current;
      if (!pos || !pos.screenPos) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        pos = { screenPos: { x: cx, y: cy }, viewportPos: { x: cx, y: cy } };
        lastMouseScreenPosRef.current = pos;
      }
      updateSmartDetect(pos);
    };


    // Lancement
    step();

  }, [updateSmartDetect, stopAutoPan]);


  // --- A. GESTION DES CLAVIERS (Key Listeners) ---
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Ignorer si l'utilisateur écrit dans un input texte
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        console.log("Action: Key Pressed while typing");
        return;
      }
      const { selectedNode, selectedPointId, selectedPartId, onDeletePoint, onHideSegment, onRemoveCut, permissions } = stateRef.current;
      const showSmartDetect = showSmartDetectRef.current;
      const enabledDrawingMode = enabledDrawingModeRef.current;

      if (e.repeat) return;

      switch (e.key) {
        // 1. ESCAPE : Reset Selection
        case 'Escape':
          console.log("Action: Reset Selection & Tool");
          if (selectedPartId) {
            dispatch(setSubSelection({ partId: null }));
            e.stopPropagation();
            return;
          }

          if (selectedPointId && selectedNode?.nodeId) {
            console.log("Action: Deselect Point");
            dispatch(setSubSelection({ pointId: null }));
            e.stopPropagation(); // Empêcher le resetNewAnnotation
            return;
          }

          // Cancel anchor pick mode if active
          if (anchorSourceAnnotationIdRef.current) {
            dispatch(setAnchorSourceAnnotationId(null));
            e.stopPropagation();
            return;
          }

          // Reset split polyline state if active
          onSplitPolylineResetRef.current?.();

          // setSelectedPointId(null); // Removed
          resetNewAnnotation();
          dispatch(setEnabledDrawingMode(null));
          dispatch(clearSelection()); // Replaces setSelectedNode(null) etc.
          // dispatch(setSelectedNode(null)); 
          // dispatch(setSelectedNodes([])); 

          dispatch(setTempAnnotations([]));
          dispatch(setSelectedEntityId(null));

          setHiddenAnnotationIds([]);
          setDrawingPoints([]);
          setBrushPath([]);
          setCutHostId(null);

          setShowSmartDetect(false);

          if (transientDetectedShapeLayerRef.current) {
            transientDetectedShapeLayerRef.current.updateShape(null);
          }
          // Clear ortho paths detection
          detectedOrthoPathsRef.current = null;
          committedOrthoSegmentsRef.current = [];
          transientOrthoPathsRef.current?.clear();
          // Clear polygon detection
          detectedPolygonRef.current = null;
          // Clear detected similar polylines
          detectedSimilarPolylinesRef.current = null;
          transientDetectedPolylinesRef.current?.clear();
          cachedDetectImageUrlRef.current = null;
          transientDetectedPolygonRef.current?.clear();
          break;

        case 'd':

          const mousePos = lastMouseScreenPosRef.current;
          setShowSmartDetect(true);
          updateSmartDetect(mousePos);
          break;

        case ' ':
          // --- DETECT_SIMILAR_POLYLINES: bulk commit all detected polylines ---
          // Uses onCommitDrawingRef (same path as rectangle/polygon detection)
          // with bulkPolylines option for batch creation.
          if (detectedSimilarPolylinesRef.current) {
            e.preventDefault();
            const { localCoords, strokeWidth: detectedStrokeWidth } = detectedSimilarPolylinesRef.current;
            if (localCoords && localCoords.length > 0) {
              console.log("[DETECT_SIMILAR_POLYLINES] Bulk committing", localCoords.length, "polylines");
              const na = newAnnotationRef.current || {};

              // Override strokeWidth with detected thickness
              const overrideAnnotation = detectedStrokeWidth
                ? { ...na, strokeWidth: detectedStrokeWidth, strokeWidthUnit: "PX" }
                : na;

              const validPolylines = localCoords.filter((pl) => pl.length >= 2);
              onCommitDrawingRef.current({
                points: validPolylines[0] || [], // dummy, not used for bulk
                options: {
                  bulkPolylines: validPolylines,
                  newAnnotation: overrideAnnotation,
                },
              });
            }
            detectedSimilarPolylinesRef.current = null;
            transientDetectedPolylinesRef.current?.clear();
            return;
          }

          // --- POLYGON DETECTION: commit detected polygon ---
          if (detectedPolygonRef.current) {
            e.preventDefault();
            const { outerRing, cuts } = detectedPolygonRef.current;
            if (outerRing && outerRing.length >= 3) {
              // Commit the detected polygon with cuts
              onCommitDrawingRef.current({
                points: outerRing,
                options: { closeLine: true, detectedCuts: cuts },
              });
              // Reset drawing state
              setDrawingPoints([]);
              drawingPointsRef.current = [];
              drawingLayerRef.current?.setPoints?.([]);
              // Clear detection
              detectedPolygonRef.current = null;
              transientDetectedPolygonRef.current?.clear();
            }
            return;
          }

          // --- ORTHO_PATHS: add detected path to drawing points ---
          if (detectedOrthoPathsRef.current) {
            e.preventDefault();
            const { imageCoords, localCoords } = detectedOrthoPathsRef.current;

            if (localCoords.length > 0 && localCoords[0].length >= 2) {
              const newPoints = mergeDetectedPolyIntoDrawing(
                drawingPointsRef.current,
                localCoords[0],
              );
              setDrawingPoints(newPoints);
              drawingPointsRef.current = newPoints;
              // Force DrawingLayer to use new points immediately (bypasses render cycle)
              drawingLayerRef.current?.setPoints?.(newPoints);
            }

            // Accumulate committed segments (in image coords) for exclusion on next click
            committedOrthoSegmentsRef.current = [
              ...committedOrthoSegmentsRef.current,
              ...imageCoords,
            ];
            // Clear detection display
            detectedOrthoPathsRef.current = null;
            transientOrthoPathsRef.current?.clear();
            return;
          }

          if (detectedShapeRef.current) {
            e.preventDefault();

            const shape = detectedShapeRef.current;

            // A. POINT (CORNER)
            if (shape.type === 'POINT' && shape.points && shape.points.length > 0) {
              const point = shape.points[0];
              const newPoints = [...drawingPointsRef.current, point];
              setDrawingPoints(newPoints);
              drawingPointsRef.current = newPoints;

              if (enabledDrawingMode === "ONE_CLICK") {
                commitPoint();
              }

              else if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode) && newPoints.length === 2) {
                commitPolyline();
              }


              console.log("Space pressed: Smart Point added", point);
            }

            // B. LINE / RECTANGLE (Multiple points)
            else if (['LINE', 'RECTANGLE', 'POLYLINE', "STRIP"].includes(shape.type) && shape.points && shape.points.length > 0) {
              // Si on n'a rien dessiné, on peut prendre la shape entière
              if (drawingPointsRef.current.length === 0) {
                setDrawingPoints(shape.points);
                drawingPointsRef.current = shape.points;
                // On commit direct si rectangle
                if (shape.type === 'RECTANGLE') {
                  commitPolyline(e, { closeLine: true });
                }
                //onCommitDrawingRef.current({ points: shape.points });
                //setDrawingPoints([]);
              } else {
                // Si on a déjà des points, on ajoute ? (Cas continuation)
                const newPoints = [...drawingPointsRef.current, ...shape.points];
                setDrawingPoints(newPoints);
                drawingPointsRef.current = newPoints;
              }
              console.log("Space pressed: Smart Shape added", shape);
            }

            return;
          }
          break;

        case "p":
          console.log("press p")
          if (showSmartDetect) smartDetectRef.current?.changeMorphKernelSize(1);
          break;

        case "M": { // Shift+M → toggle quick point editing mode
          if (!isActiveViewerRef.current) break;
          const newMode = mapEditorModeRef.current === "QUICK_POINTS_CHANGE" ? null : "QUICK_POINTS_CHANGE";
          dispatch(setMapEditorMode(newMode));
          break;
        }

        case "O": { // Shift+O → toggle ortho snap
          if (!isActiveViewerRef.current) break;
          dispatch(setOrthoSnapEnabled(!orthoSnapEnabledRef.current));
          break;
        }

        case "m":
          if (showSmartDetect) smartDetectRef.current?.changeMorphKernelSize(-1);
          break;

        case "s": {
          if (!isActiveViewerRef.current) break;
          const na = newAnnotationRef.current;
          if (enabledDrawingMode && na?.type === "STRIP") {
            const newOrientation = (na.stripOrientation ?? 1) * -1;
            dispatch(setNewAnnotation({
              ...na,
              stripOrientation: newOrientation,
            }));
            // Force redraw with last cursor position
            if (lastPreviewPosRef.current) {
              requestAnimationFrame(() => {
                drawingLayerRef.current?.updatePreview(lastPreviewPosRef.current);
              });
            }
          }
          break;
        }

        case "Enter":
          if (enabledDrawingModeRef.current === "SPLIT_POLYLINE") {
            const splitResult = await onSplitPolylineEnterRef.current?.();
            if (splitResult?.status === "split_done") {
              setDrawingPoints([]);
              drawingPointsRef.current = [];
            }
            break;
          }
          if (["CLICK", "POLYLINE_CLICK", "POLYGON_CLICK", "CUT_CLICK", "SPLIT_CLICK", "STRIP", "BRUSH"].includes(enabledDrawingModeRef.current)) {
            commitPolyline();
          }

          if (enabledDrawingModeRef.current === "SMART_DETECT") {
            const localPoints = smartDetectRef.current?.getDetectedPoints();
            const roiData = lastSmartROI.current; // On récupère ce qu'on a stocké

            if (localPoints && roiData) {
              const ratio = roiData.width / LOUPE_SIZE;
              const finalPoints = localPoints.map(p => ({
                x: roiData.x + (p.x * ratio),
                y: roiData.y + (p.y * ratio)
              }));

              // Commit...
            }
          }
          break;

        // 2. DELETE / BACKSPACE : Supprimer
        case 'Delete':
        case 'Backspace':
          // Don't intercept when user is typing in an input field
          if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) break;
          console.log("Action: Delete Selected");
          // 1. Si un point est sélectionné, on le supprime
          if (selectedPointId && onDeletePoint) {
            // PERMISSION GUARD : bloquer si pas propriétaire de l'annotation
            if (!permissions.canEditAnnotation(selectedNode?.nodeId)) break;
            console.log("Action: Delete Point", selectedPointId, selectedNode?.nodeId);
            onDeletePoint({ pointId: selectedPointId, annotationId: selectedNode?.nodeId });
            setSelectedPointId(null); // Reset selection
            e.stopPropagation();
            return;
          }
          else if (selectedPartId && selectedNode?.nodeId) {
            // PERMISSION GUARD : bloquer si pas propriétaire de l'annotation
            if (!permissions.canEditAnnotation(selectedNode?.nodeId)) break;
            const parts = selectedPartId.split('::'); // annotationId::TYPE::index
            const type = parts[1];
            const index = parseInt(parts[2], 10);

            // A. Suppression de SEGMENT (Cacher)
            if (type === 'SEG' && onHideSegment) {
              onHideSegment({
                annotationId: selectedNode.nodeId,
                segmentIndex: index
              });
              setSelectedPartId(null);
              e.stopPropagation();
              return;
            }

            // B. Suppression de CUT (Trou)
            if (type === 'CUT' && onRemoveCut) {
              onRemoveCut({
                annotationId: selectedNode.nodeId,
                cutIndex: index
              });
              setSelectedPartId(null);
              e.stopPropagation();
              return;
            }
          }
          else if (selectedNode?.nodeId) {
            // PERMISSION GUARD : bloquer si pas propriétaire de l'annotation
            if (!permissions.canEditAnnotation(selectedNode?.nodeId)) break;
            dispatch(setOpenDialogDeleteSelectedAnnotation(true));
            e.stopPropagation();
          }

          break;

        // 3. FLÈCHES : Pan Caméra (Délégué au Viewport)
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          if (enabledDrawingModeRef.current === 'SMART_DETECT') {
            e.preventDefault();
            // Si c'est déjà actif dans la même direction, on ne fait rien
            if (autoPanRef.current?.active && autoPanRef.current?.direction === e.key) {
              return;
            }
            // Si c'est actif dans une AUTRE direction, on change de direction (le startAutoPan gère le reset)
            startAutoPan(e.key);
            return;
          }

          const step = e.shiftKey ? 2 : 50;

          const panByXMap = {
            "ArrowRight": -step,
            "ArrowLeft": step,
            "ArrowUp": 0,
            "ArrowDown": 0
          }
          const panByYMap = {
            "ArrowRight": 0,
            "ArrowLeft": 0,
            "ArrowUp": step,
            "ArrowDown": -step
          }
          viewportRef.current?.panBy(panByXMap[e.key], panByYMap[e.key]);
          break;

        default:
          break;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "Escape" || e.key === " ") {
        stopAutoPan("USER_CANCEL");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    }
  }, []);


  // --- GESTION DES CLICS (Ajout de point) ---
  const handleWorldClick = async ({ worldPos, viewportPos, event }) => {


    //Déclencher le flash visuel au clic
    if (enabledDrawingMode) {
      screenCursorRef.current?.triggerFlash();
    }

    if (newAnnotation.type === "CUT" && enabledDrawingMode) {
      const target = event.target;
      const hit = target.closest?.("[data-node-type]");
      if (hit) {
        const { nodeId, annotationType } =
          hit.dataset;
        console.log("[InteractionLayer] CUT HOST ID", annotationType, cutHostId)
        if (["POLYGON", "STRIP"].includes(annotationType) && !cutHostId) {
          console.log("[InteractionLayer] CUT HOST ID", nodeId)
          setCutHostId(nodeId)
        }
      }
    }

    // Anchor pick mode: click selects the target annotation
    if (anchorSourceAnnotationId && !enabledDrawingMode) {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hit = nativeTarget.closest?.('[data-node-type="ANNOTATION"]');
      if (hit) {
        const targetId = hit.dataset.nodeId;
        if (targetId !== anchorSourceAnnotationId) {
          await anchorAnnotationToTarget(anchorSourceAnnotationId, targetId);
          dispatch(setAnchorSourceAnnotationId(null));
        }
      } else {
        // Click on empty space cancels anchor mode
        dispatch(setAnchorSourceAnnotationId(null));
      }
      return;
    }

    // --- CUT_SEGMENT: click on a segment to cut the polyline ---
    if (enabledDrawingMode === "CUT_SEGMENT") {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hitPart = nativeTarget.closest?.("[data-part-id]");
      if (hitPart) {
        const { partId, nodeId, partType: dataPartType } = hitPart.dataset;
        if (partId) {
          const parts = partId.split("::"); // annotationId::SEG::index
          const partType = dataPartType || parts[1];
          const segmentIndex = parseInt(parts[2], 10);
          if (partType === "SEG" && onCutSegment && !isNaN(segmentIndex)) {
            onCutSegment(nodeId, segmentIndex);
          }
        }
      }
      return;
    }

    // --- TECHNICAL_RETURN: click on a segment to create 1m return ---
    if (enabledDrawingMode === "TECHNICAL_RETURN") {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hitPart = nativeTarget.closest?.("[data-part-id]");
      if (hitPart) {
        const { partId, nodeId, partType: dataPartType } = hitPart.dataset;
        if (partId) {
          const parts = partId.split("::"); // annotationId::SEG::index
          const partType = dataPartType || parts[1];
          const segmentIndex = parseInt(parts[2], 10);
          if (partType === "SEG" && onTechnicalReturn && !isNaN(segmentIndex)) {
            onTechnicalReturn(nodeId, segmentIndex);
          }
        }
      }
      return;
    }

    // --- SPLIT_POLYLINE_CLICK: single-click split at snap point ---
    if (enabledDrawingMode === "SPLIT_POLYLINE_CLICK") {
      const snap = currentSnapRef.current;
      if (!snap) return;
      const result = await onSplitPolylineClickPoint(snap);
      if (result?.status === "split_done") {
        setSplitFlashPoint({ x: snap.x, y: snap.y });
      }
      return;
    }

    // --- SPLIT_POLYLINE: 2-click snap-based polyline split ---
    if (enabledDrawingMode === "SPLIT_POLYLINE") {
      const snap = currentSnapRef.current;
      if (!snap) return; // No snap → ignore click

      // Convert snap pixel position to drawingPoints for visual feedback
      const pose = viewportRef.current?.getPose?.() || { x: 0, y: 0, k: 1 };
      const localX = snap.x;
      const localY = snap.y;

      const result = await onSplitPolylineClick(snap);
      if (result?.status === "first_point_set") {
        setDrawingPoints([{ x: localX, y: localY }]);
        drawingPointsRef.current = [{ x: localX, y: localY }];
      } else if (result?.status === "split_done") {
        setDrawingPoints([]);
        drawingPointsRef.current = [];
      }
      // On error, keep current state
      return;
    }

    // --- DETECT_SIMILAR_POLYLINES: full-image detection from click calibration ---
    if (enabledDrawingMode === "DETECT_SIMILAR_POLYLINES") {
      // Clear previous detection on re-click
      detectedSimilarPolylinesRef.current = null;
      transientDetectedPolylinesRef.current?.clear();

      const localPos = toLocalCoords(worldPos);
      const pixelX = (localPos.x - baseMapImageOffset.x) / baseMapImageScale;
      const pixelY = (localPos.y - baseMapImageOffset.y) / baseMapImageScale;

      // Gather visible annotation segments for exclusion mask.
      // The `annotations` prop is already filtered by useAnnotationsV2 (layers, scopes,
      // visibility, etc.) so only currently visible annotations are excluded.
      // Convert from local coords to image pixel coords for the worker.
      const existingSegments = (annotations || [])
        .filter((a) => a.points && a.points.length >= 2 && ["POLYLINE", "POLYGON"].includes(a.type))
        .map((a) =>
          a.points.map((p) => ({
            x: (p.x - baseMapImageOffset.x) / baseMapImageScale,
            y: (p.y - baseMapImageOffset.y) / baseMapImageScale,
          }))
        );

      // Lazy-build image data URL
      if (!cachedDetectImageUrlRef.current && sourceImageEl) {
        const canvas = document.createElement("canvas");
        canvas.width = sourceImageEl.naturalWidth || sourceImageEl.width;
        canvas.height = sourceImageEl.naturalHeight || sourceImageEl.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(sourceImageEl, 0, 0);
        cachedDetectImageUrlRef.current = canvas.toDataURL("image/jpeg", 0.9);
      }

      const imageUrl = cachedDetectImageUrlRef.current;
      if (!imageUrl) return;

      // Show spinner on cursor
      screenCursorRef.current?.showSpinner?.();

      (async () => {
        try {
          await cv.load();
          const result = await cv.detectSimilarPolylinesAsync({
            imageUrl,
            clickX: pixelX,
            clickY: pixelY,
            existingSegments,
            offsetAngle: orthoSnapAngleOffsetRef.current || 0,
          });
          console.log("[DETECT_SIMILAR_POLYLINES] Worker result:", result);
          const segments = result?.polylines || (Array.isArray(result) ? result : []);
          const detectedThickness = result?.thickness || 2;
          // Convert thickness from image pixels to local coords
          const localThickness = detectedThickness * baseMapImageScale;

          if (segments && segments.length > 0) {
            const localPolylines = segments.map(seg =>
              seg.map(p => ({
                x: p.x * baseMapImageScale + baseMapImageOffset.x,
                y: p.y * baseMapImageScale + baseMapImageOffset.y,
              }))
            );
            detectedSimilarPolylinesRef.current = {
              imageCoords: segments,
              localCoords: localPolylines,
              strokeWidth: localThickness,
            };
            transientDetectedPolylinesRef.current?.updatePolylines(localPolylines);
            dispatch(setToaster({
              message: `${segments.length} segments detected — press [Space] to validate`,
            }));
          } else {
            detectedSimilarPolylinesRef.current = null;
            transientDetectedPolylinesRef.current?.clear();
            dispatch(setToaster({ message: "No similar lines detected", isError: true }));
          }
        } catch (err) {
          console.error("[DETECT_SIMILAR_POLYLINES] detection error:", err);
        } finally {
          screenCursorRef.current?.hideSpinner?.();
        }
      })();
      return;
    }

    if (["CLICK", "POLYLINE_CLICK", "POLYGON_CLICK", "CUT_CLICK", "SPLIT_CLICK", "STRIP"].includes(enabledDrawingMode)) {
      // --- ORTHO_PATHS intercept: run BFS tracing instead of adding a point ---
      // (not for POLYGON_CLICK — polygon detection uses annotation geometry, not ORTHO_PATHS)
      const currentDetectMode = smartDetectRef.current?.getSelectedDetectMode?.();
      if (currentDetectMode === "ORTHO_PATHS" && showSmartDetectRef.current && enabledDrawingMode !== "POLYGON_CLICK" && advancedLayout) {
        let localPos = toLocalCoords(worldPos);

        // Apply shift-snap (ortho/45°) before adding the point
        if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPointsRef.current.length > 0) {
          const lastPoint = drawingPointsRef.current[drawingPointsRef.current.length - 1];
          const offset = orthoSnapEnabledRef.current ? orthoSnapAngleOffsetRef.current : 0;
          localPos = snapToAngle(localPos, lastPoint, offset);
        }

        // Add click point to drawing points so DrawingLayer renders the polyline in progress
        const newPoints = [...drawingPointsRef.current, localPos];
        setDrawingPoints(newPoints);
        drawingPointsRef.current = newPoints;

        // Convert local coords to source image pixel coords
        const pixelX = (localPos.x - baseMapImageOffset.x) / baseMapImageScale;
        const pixelY = (localPos.y - baseMapImageOffset.y) / baseMapImageScale;

        // Build visited segments from existing annotations + committed this session
        const existingAnnotationSegments = (annotations || [])
          .filter((a) => a.points && a.points.length >= 2 && ["POLYLINE", "POLYGON"].includes(a.type))
          .map((a) =>
            a.points.map((p) => ({
              x: (p.x - baseMapImageOffset.x) / baseMapImageScale,
              y: (p.y - baseMapImageOffset.y) / baseMapImageScale,
            }))
          );
        // committedOrthoSegmentsRef has image-pixel coords of all previously validated
        // detections — no need to also add drawingPoints (would double-exclude and
        // cause tiny BFS results). The merge function handles overlap cleanup.
        const allVisitedSegments = [
          ...existingAnnotationSegments,
          ...committedOrthoSegmentsRef.current,
        ];

        // Run async ortho path tracing
        (async () => {
          try {
            const polylines = await smartDetectRef.current.runOrthoPaths({
              clickX: pixelX,
              clickY: pixelY,
              visitedSegments: allVisitedSegments,
            });
            if (polylines && polylines.length > 0) {
              // Convert from image pixel coords to local coords
              const localPolylines = polylines.map((seg) =>
                seg.map((p) => ({
                  x: p.x * baseMapImageScale + baseMapImageOffset.x,
                  y: p.y * baseMapImageScale + baseMapImageOffset.y,
                }))
              );
              detectedOrthoPathsRef.current = { imageCoords: polylines, localCoords: localPolylines };
              transientOrthoPathsRef.current?.updatePaths(localPolylines);
            } else {
              detectedOrthoPathsRef.current = null;
              transientOrthoPathsRef.current?.clear();
            }
          } catch (err) {
            console.error("[ORTHO_PATHS] tracing error:", err);
          }
        })();
        return; // Don't add a regular drawing point
      }

      // Apply snapping if Shift is pressed or ortho snap is enabled
      let finalPos = toLocalCoords(worldPos);
      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const offset = orthoSnapEnabledRef.current ? orthoSnapAngleOffsetRef.current : 0;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }

      // 1. Ajouter le point (Déclenche un re-render de DrawingLayer pour la partie statique)
      setDrawingPoints(prev => [...prev, finalPos]);

      // 2. Si on a fini (ex: double clic ou fermeture), on commit
      // if (isClosing) { saveToDb(drawingPoints); setDrawingPoints([]); }
    }

    // --- CASE 2: ONE_CLICK (Auto-commit after 1 point) ---
    else if (enabledDrawingMode === 'ONE_CLICK') {
      // Apply snapping if Shift is pressed or ortho snap is enabled
      let finalPos = toLocalCoords(worldPos);
      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const offset = orthoSnapEnabledRef.current ? orthoSnapAngleOffsetRef.current : 0;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }

      // 1. Ajouter le point (Déclenche un re-render de DrawingLayer pour la partie statique)
      setDrawingPoints(prev => [...prev, finalPos]);
      drawingPointsRef.current = [finalPos];
      commitPoint();
    }

    // --- CASE 3: MEASURE / SEGMENT (Auto-commit after 2 points) ---
    else if (["MEASURE", "SEGMENT", "RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode)) {
      let finalPos = toLocalCoords(worldPos);

      // Apply Angle Snap (Ortho) if Shift is held or ortho snap is enabled
      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const offset = orthoSnapEnabledRef.current ? orthoSnapAngleOffsetRef.current : 0;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }

      // Calculate the new list of points
      const nextPoints = [...drawingPoints, finalPos];

      // Update State (for visual feedback if it doesn't close immediately)
      setDrawingPoints(nextPoints);

      // Check if finished
      if (nextPoints.length === 2) {
        // 1. Force Ref Update immediately (React state is too slow)
        drawingPointsRef.current = nextPoints;

        // 2. Trigger Commit
        // This will call onCommitDrawingRef.current(points) inside InteractionLayer
        commitPolyline(event);
        if (enabledDrawingMode === "MEASURE") dispatch(setEnabledDrawingMode(null));
      }


    }

    // --- CASE 3b: CIRCLE (Auto-commit after 3 points) ---
    else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode)) {
      let finalPos = toLocalCoords(worldPos);

      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const offset = orthoSnapEnabledRef.current ? orthoSnapAngleOffsetRef.current : 0;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }

      const nextPoints = [...drawingPoints, finalPos];
      setDrawingPoints(nextPoints);

      if (nextPoints.length === 3) {
        drawingPointsRef.current = nextPoints;
        commitPolyline(event);
      }
    }

    // -- CASE 4: SURFACE_DROP (opencv contour detection)
    else if (enabledDrawingMode === "SURFACE_DROP") {
      await cv.load();
      const localPos = toLocalCoords(worldPos);

      // Convert local coords to source image pixel coords
      const pixelX = (localPos.x - baseMapImageOffset.x) / baseMapImageScale;
      const pixelY = (localPos.y - baseMapImageOffset.y) / baseMapImageScale;

      const viewportBounds = editor.viewportInBase?.bounds;
      let viewportBBox;
      if (
        viewportBounds &&
        Number.isFinite(viewportBounds.x) &&
        Number.isFinite(viewportBounds.y) &&
        Number.isFinite(viewportBounds.width) &&
        Number.isFinite(viewportBounds.height)
      ) {
        viewportBBox = {
          x: (viewportBounds.x - baseMapImageOffset.x) / baseMapImageScale,
          y: (viewportBounds.y - baseMapImageOffset.y) / baseMapImageScale,
          width: Math.max(1, viewportBounds.width / baseMapImageScale),
          height: Math.max(1, viewportBounds.height / baseMapImageScale),
        };
      }

      // Collect visible annotation boundaries as barriers (in source image pixel coords)
      const boundaries = (annotations || [])
        .filter(a => (a.type === "POLYLINE" || a.type === "POLYGON") && a.points?.length >= 2)
        .map(a => ({
          points: a.points.map(p => ({
            x: (p.x - baseMapImageOffset.x) / baseMapImageScale,
            y: (p.y - baseMapImageOffset.y) / baseMapImageScale,
          })),
          closed: a.type === "POLYGON",
        }));

      const { points, cuts } = await cv.detectContoursAsync({
        imageUrl: baseMapImageUrl,
        x: pixelX,
        y: pixelY,
        viewportBBox,
        boundaries,
      });

      // Convert returned points from source pixel coords back to local coords
      const toLocal = (p) => ({
        x: p.x * baseMapImageScale + baseMapImageOffset.x,
        y: p.y * baseMapImageScale + baseMapImageOffset.y,
      });
      const rawLocalPoints = points.map(toLocal);
      const rawLocalCuts = cuts?.map(cut => ({
        ...cut,
        points: cut.points.map(toLocal),
      }));

      const { points: localPoints, cuts: localCuts } = alignPolygonsToGrid(
        rawLocalPoints,
        rawLocalCuts,
        {
          referenceAngle: orthoSnapAngleOffsetRef.current || null,
          meterByPx: baseMapMeterByPx || 0,
        }
      );

      const topMiddlePoint = getTopMiddlePoint(localPoints);
      const pose = getTargetPose(); // getTargetPose retourne basePose par défaut
      const worldX = topMiddlePoint.x * pose.k + pose.x;
      const worldY = topMiddlePoint.y * pose.k + pose.y;
      const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);
      if (onCommitPointsFromSurfaceDrop) {
        onCommitPointsFromSurfaceDrop({ points: localPoints, cuts: localCuts, screenPos });
      }
    }

    else if (enabledDrawingMode === "SMART_DETECT") {
      commitPolyline(event);
    }

    else if (enabledDrawingMode === "SMART_TRANSFORMER") {
      if (smartTransformerRef.current) {
        smartTransformerRef.current.trigger();
      }
    }

    else if (!enabledDrawingMode) {
      const nativeTarget = event.nativeEvent?.target || event.target;

      // A. DÉTECTION DU CLIC SUR UN POINT (VERTEX)
      // Les points auront data-node-type="VERTEX"
      const hitPoint = nativeTarget.closest?.('[data-node-type="VERTEX"]');

      if (hitPoint) {
        const { pointId, annotationId } = hitPoint.dataset;
        // Si l'annotation est déjà sélectionnée, on sélectionne le point
        if (selectedNode?.nodeId === annotationId) {
          console.log("Select Point:", pointId);
          dispatch(setSubSelection({ pointId, partType: "VERTEX" }));
          onToggleAnnotationPointType({ annotationId, pointId });
          // On arrête ici pour ne pas relancer la sélection de noeud
          return;
        }
      } else {
        // Si on clique ailleurs (sur le trait ou le vide), on déselectionne le point
        // mais on garde peut-être partType si on sélectionne une part?
        // setSubSelection update ce qu'on lui donne.
        if (selectedPointId) dispatch(setSubSelection({ pointId: null }));
      }

      // 2. Ensuite les Parts (Segments / Contours)
      // On cherche un élément avec data-part-id
      const hitPart = nativeTarget.closest?.('[data-part-id]');

      if (hitPart) {
        const { partId, nodeId, partType } = hitPart.dataset;
        const isParentSelected = selectedNode?.nodeId === nodeId;

        if (isParentSelected) {
          console.log("Selecting Part:", partId, partType);
          // Toggle part selection
          const nextPartId = selectedPartId === partId ? null : partId;
          const nextPartType = selectedPartId === partId ? null : partType;
          dispatch(setSubSelection({ partId: nextPartId, partType: nextPartType }));
          return;
        }
      }

      // 3. Ensuite les Noeuds
      const hit = nativeTarget.closest?.("[data-node-type]");
      if (hit) {
        console.log("[InteractionLayer] selected node", hit?.dataset)

        // 3a. Click on a version image in BASE_MAPS viewer → select version
        if (hit?.dataset?.nodeType === "BASE_MAP_VERSION") {
          const versionId = hit?.dataset?.nodeId;
          dispatch(setSelectedVersionId(versionId));
          dispatch(setSelectedItem({
            id: versionId,
            type: "BASE_MAP_VERSION",
          }));
          setHiddenAnnotationIds([]);
          dispatch(setAnnotationToolbarPosition(null));
        }

        else if (
          !showBgImage && hit?.dataset?.nodeType === "BASE_MAP"
          || showBgImage && hit?.dataset?.nodeType === "BG_IMAGE"

        ) {
          dispatch(clearSelection());
          // dispatch(setSelectedNode(null)); // Legacy
          // dispatch(setSelectedNodes([])); // Legacy
          setHiddenAnnotationIds([]);
          dispatch(setAnnotationToolbarPosition(null));
        }

        // --- 2. GESTION DES ANNOTATIONS ---
        else if (
          hit?.dataset?.nodeType === "ANNOTATION" && !showBgImage
          || hit?.dataset?.nodeContext === "BG_IMAGE"
        ) {
          const annotation = annotations?.find((a) => a.id === hit?.dataset.nodeId);

          let panelAnchor = null;
          if (annotation) panelAnchor = getAnnotationEditionPanelAnchor(annotation);

          console.log("debug_2701_clicked_annotation", annotation, panelAnchor)

          // --- 2.1. GESTION DES ANNOTATIONS ---

          let _selectedItems = [...selectedItems];
          const newItem = {
            id: hit.dataset.nodeId,
            type: "NODE",
            nodeId: hit.dataset.nodeId,
            nodeType: hit.dataset.nodeType, // "ANNOTATION"
            annotationType: hit.dataset.annotationType, // "POLYLINE", "MARKER", etc.
            entityId: hit.dataset.nodeEntityId,
            listingId: hit.dataset.nodeListingId,
            annotationTemplateId: annotation?.annotationTemplateId,
            nodeContext: hit.dataset.nodeContext, // Optional but useful for EditedObjectLayer
            partId: null,
            partType: null
          };

          if (event.shiftKey) {
            // Toggle
            dispatch(toggleItemSelection(newItem));
            // Update local var for immediate logic (toolbar)
            const exists = _selectedItems.find(i => i.id === newItem.id);
            if (exists) {
              _selectedItems = _selectedItems.filter(i => i.id !== newItem.id);
            } else {
              _selectedItems.push(newItem);
            }
          } else {
            // Replace
            _selectedItems = [newItem];
            dispatch(setSelectedItem(newItem));
            dispatch(setShowAnnotationsProperties(true));
          }


          // -- Afichage du toolbar pour édition --

          if (_selectedItems.length > 1) {
            const _annotations = annotations.filter((a) => _selectedItems.some((s) => s.nodeId === a.id));
            const bbox = mergeBboxes(_annotations.map((a) => getAnnotationBBox(a)));
            if (bbox) {
              panelAnchor = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
              console.log("debug_151_panelAnchor", panelAnchor);
            }
          }

          if (panelAnchor) {
            // 2. Convertir LOCAL -> MONDE
            const isBgContext = hit?.dataset?.nodeContext === "BG_IMAGE";
            const pose = isBgContext ? bgPose : getTargetPose();

            const worldX = panelAnchor.x * pose.k + pose.x;
            const worldY = panelAnchor.y * pose.k + pose.y;

            // 3. Convertir MONDE -> ÉCRAN (Viewport)
            const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);


            if (_selectedItems.length > 1) {
              dispatch(setAnnotationsToolbarPosition(screenPos));
            } else {
              console.log("debug_2701_setAnnotationToolbarPosition", screenPos);
              dispatch(
                setAnnotationToolbarPosition({ x: screenPos?.x, y: screenPos?.y })
              );
            }

            if (tooltipData) setTooltipData(null);
          }

        }
        else if (showBgImage && hit?.dataset?.nodeType !== "ANNOTATION") {
          // Legacy handling for non-annotation nodes in BG mode (Legend?)
          // dispatch(setSelectedNode(hit?.dataset));
          dispatch(setSelectedItem({
            id: hit.dataset.nodeId,
            nodeId: hit.dataset.nodeId,
            type: "NODE",
            nodeType: hit.dataset.nodeType,
            nodeContext: hit.dataset.nodeContext,
            partId: null,
            partType: null
          }));
          setHiddenAnnotationIds([hit?.dataset.nodeId]);
        }


      }

      else {
        dispatch(clearSelection());
        // dispatch(setSelectedNode(null));
        // dispatch(setSelectedNodes([]));
        setHiddenAnnotationIds([]);
      }
    }
  };

  // --- GESTION DU MOUVEMENT (Feedback visuel) ---
  const handleWorldMouseMove = ({ worldPos, viewportPos, event, isPanning }) => {

    lastMouseScreenPosRef.current = {
      screenPos: { x: event.clientX, y: event.clientY },
      viewportPos: viewportPos
    };

    const showSmartDetect = showSmartDetectRef.current;
    const dragState = dragStateRef.current;
    const dragAnnotationState = dragAnnotationStateRef.current;

    if (enabledDrawingModeRef.current === "SMART_TRANSFORMER") {
      if (smartTransformerRef.current) {
        smartTransformerRef.current.clear();
      }
    }

    if (lassoRect) {
      updateLasso(event);
      return;
    }


    // --- 1. DÉTECTION DE L'ÉTAT D'INTERACTION ---
    // Est-ce qu'une action prioritaire est en cours ?
    const isInteracting =
      isPanning ||
      dragState?.active ||
      dragAnnotationState?.active ||
      dragBaseMapState?.active ||
      dragLegendState?.active ||
      dragTextState?.active ||
      calibrationDragState?.active ||
      enabledDrawingModeRef.current ||
      selectedNode;

    // --- 2. MISE À JOUR VISUELLE (Tooltip Position) ---
    // On met à jour la position DOM directement pour la fluidité (60fps), 
    // même si on va peut-être le cacher juste après.
    if (tooltipRef.current) {
      const x = viewportPos.x + 15;
      const y = viewportPos.y + 15;
      tooltipRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }

    // --- 3. GESTION DE LA VISIBILITÉ DU TOOLTIP ---
    // Si on interagit, on cache le tooltip via le State React.
    // IMPORTANT : On ne fait PAS de return ici, pour laisser le code de drag s'exécuter.
    if (isInteracting) {
      if (tooltipData) setTooltipData(null);
    }

    // --- 4. EXÉCUTION DES ACTIONS (Drag, Draw, Pan) ---

    // Mise à jour du curseur visuel (ScreenCursor)
    if (enabledDrawingMode || dragState?.active || dragAnnotationState?.active) {
      screenCursorRef.current?.move(viewportPos.x, viewportPos.y);
    }

    // Nettoyage visuel pendant le Pan
    if (isPanning) {
      closingMarkerRef.current?.update(null);
      snappingLayerRef.current?.update(null);
    }

    // A. DRAG POINT (Vertex) — délégué à usePointDrag
    if (dragState?.pending || dragState?.active) {

      // Snap detection during active drag (VERTEX, MIDPOINT, PROJECTION)
      let snapOverride = null;
      if (dragState?.active && snappingEnabled) {
        const imageScale = getTargetScale();
        const currentCameraZoom = viewportRef.current?.getZoom() || 1;
        const scale = imageScale * currentCameraZoom;
        const localPos = toLocalCoords(worldPos);
        const snapThreshold = SNAP_THRESHOLD_ABSOLUTE / scale;

        // Exclude the dragged point from snap targets
        const dragPointId = dragStateRef.current?.originalPointId || dragStateRef.current?.pointId;
        const annotationsExcludingDragPoint = annotations?.map(ann => ({
          ...ann,
          points: ann.points?.filter(pt => pt.id !== dragPointId),
          cuts: ann.cuts?.map(cut => ({
            ...cut,
            points: cut.points?.filter(pt => pt.id !== dragPointId),
          })),
        }));

        const snapResult = getBestSnap(localPos, annotationsExcludingDragPoint, snapThreshold, {vertex: true, midpoint: true, projection: true});

        if (snapResult?.type === "VERTEX") {
          currentSnapRef.current = snapResult;
          snapOverride = { x: snapResult.x, y: snapResult.y, pointId: snapResult.id };

          const pose = getTargetPose();
          const worldSnapX = snapResult.x * pose.k + pose.x;
          const worldSnapY = snapResult.y * pose.k + pose.y;
          const screenSnap = viewportRef.current?.worldToViewport(worldSnapX, worldSnapY);
          if (screenSnap) {
            snappingLayerRef.current?.update({ ...screenSnap, type: "VERTEX" });
          }
        } else if (snapResult?.type === "MIDPOINT" || snapResult?.type === "PROJECTION") {
          const pose = getTargetPose();
          const worldSnapX = snapResult.x * pose.k + pose.x;
          const worldSnapY = snapResult.y * pose.k + pose.y;
          const screenSnap = viewportRef.current?.worldToViewport(worldSnapX, worldSnapY);

          // For PROJECTION, check screen distance — skip snap if too far (>10px)
          let screenDistance;
          let tooFar = false;
          if (snapResult.type === 'PROJECTION' && screenSnap) {
            const dx = screenSnap.x - viewportPos.x;
            const dy = screenSnap.y - viewportPos.y;
            screenDistance = Math.sqrt(dx * dx + dy * dy);
            tooFar = screenDistance > 10;
          }

          if (tooFar) {
            currentSnapRef.current = null;
            snappingLayerRef.current?.update(null);
          } else {
            currentSnapRef.current = snapResult;
            snapOverride = {
              x: snapResult.x, y: snapResult.y,
              projectionSnap: {
                annotationId: snapResult.previewAnnotationId,
                segmentStartId: snapResult.segmentStartId,
                segmentEndId: snapResult.segmentEndId,
                cutIndex: snapResult.cutIndex,
              },
            };

            if (screenSnap) {
              snappingLayerRef.current?.update({ ...screenSnap, type: snapResult.type, screenDistance });
            }
          }
        } else {
          currentSnapRef.current = null;
          snappingLayerRef.current?.update(null);
        }
      }

      const consumed = handlePointDragMove(worldPos, event, snapOverride);
      if (consumed) return;
    }

    // B1. DRAG BASEMAP (Image de fond) — délégué à useBaseMapDrag
    if (dragBaseMapState?.active) {
      const consumed = handleBaseMapDragMove(worldPos);
      if (consumed) return;
    }

    // B1b. DRAG VERSION — délégué à useVersionDrag
    if (versionDragState?.active) {
      const consumed = handleVersionDragMove(worldPos);
      if (consumed) return;
    }

    // B1c. DRAG CALIBRATION TARGET
    if (calibrationDragState?.active) {
      const consumed = handleCalibrationDragMove(worldPos);
      if (consumed) return;
    }

    // B2. DRAG LEGEND (Légende) — délégué à useLegendDrag
    if (dragLegendState?.active) {
      const consumed = handleLegendDragMove(worldPos);
      if (consumed) return;
    }

    if (dragTextState?.active) {
      const { startMouseWorld, handleType, startWidth } = dragTextState;

      // Calcul du delta.
      // Attention : NodeTextStatic affiche le texte en taille écran fixe (inversé au zoom) ?
      // NON, dans votre NodeTextStatic fourni, vous avez commenté le 'scaleStyle'.
      // Cela veut dire que le texte grossit quand on zoome la carte.
      // Donc 'width' est probablement en unités "Image" ou "Monde".

      // Si le texte est dans le repère image (comme BaseMap) :
      const dxWorld = worldPos.x - startMouseWorld.x;

      // Il faut convertir ce delta Monde en delta "Pixels stockés".
      // Si 'text.width' est en pixels écran absolus (ce qui semble être le cas vu estimateWidthPx),
      // alors il faut projeter le delta monde -> écran -> échelle 1.

      // Cependant, NodeTextStatic utilise : pixelX = x * imageWidth.
      // Et foreignObject width={storedWidth}.
      // Donc storedWidth est en PIXELS de l'espace SVG (qui correspond aux pixels de l'image de fond si zoom=1).

      // Donc DeltaWidth = dxWorld / bgPose.k (pour revenir au référentiel image).
      const dxLocal = dxWorld / bgPose.k;

      let newWidth = startWidth;

      // Si startWidth était null (auto), on doit l'initialiser avec la taille actuelle mesurée
      // C'est complexe sans ref. On peut assumer une valeur par défaut ou forcer l'init au mousedown.

      if (newWidth === 0) newWidth = 100; // Fallback

      if (handleType === 'E') newWidth += dxLocal;
      else if (handleType === 'W') newWidth -= dxLocal;

      newWidth = Math.max(20, newWidth);

      // Update Redux/DB
      // onUpdateAnnotation(id, { width: newWidth });

      return;
    }

    // C. DRAG ANNOTATION (Objet entier) — délégué à useAnnotationDrag
    if (dragAnnotationState?.pending || dragAnnotationState?.active) {
      const consumed = handleAnnotationDragMove(event);
      if (consumed) return;
    }

    // D. SNAPPING
    // Correction : On autorise le snapping pendant le dessin (enabledDrawingMode)
    // On l'interdit seulement pour le Pan ou le Drag d'objets lourds
    const preventSnapping = isPanning || dragAnnotationState?.active || dragBaseMapState?.active || SEGMENT_SELECT_MODES.includes(enabledDrawingMode);

    let snapResult;
    if (snappingEnabled && !preventSnapping) {

      const imageScale = getTargetScale();
      const currentCameraZoom = viewportRef.current?.getZoom() || 1;
      const scale = imageScale * currentCameraZoom;
      const localPos = toLocalCoords(worldPos);
      const snapThreshold = SNAP_THRESHOLD_ABSOLUTE / scale;

      const snapModes = getSnapModes({
        isDrawing: Boolean(enabledDrawingMode),
        isQuickEdit: mapEditorMode === "QUICK_POINTS_CHANGE",
        hasSelection: Boolean(selectedAnnotation?.id),
      });
      snapResult = getBestSnap(localPos, annotationsForSnap, snapThreshold, snapModes);

      if (snapResult) {
        currentSnapRef.current = snapResult;
        const pose = getTargetPose();
        const worldSnapX = snapResult.x * pose.k + pose.x;
        const worldSnapY = snapResult.y * pose.k + pose.y;
        const screenSnap = viewportRef.current?.worldToViewport(worldSnapX, worldSnapY);

        if (screenSnap) {
          // Compute screen distance for PROJECTION type (used to hide helper when too far)
          let screenDistance;
          if (snapResult.type === 'PROJECTION') {
            const dx = screenSnap.x - viewportPos.x;
            const dy = screenSnap.y - viewportPos.y;
            screenDistance = Math.sqrt(dx * dx + dy * dy);
          }
          snappingLayerRef.current?.update({ ...screenSnap, type: snapResult.type, screenDistance });
        }
      } else {
        snappingLayerRef.current?.update(null);
      }
    } else {
      // Nettoyage si on ne snap pas
      snappingLayerRef.current?.update(null);
    }

    // E. DRAWING PREVIEW
    if (['CLICK', 'POLYLINE_CLICK', 'POLYGON_CLICK', 'CUT_CLICK', 'SPLIT_CLICK', 'STRIP', 'ONE_CLICK', "MEASURE", "RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode)) {
      const localPos = toLocalCoords(worldPos);
      let previewPos = localPos;

      // Angle snap drawing (use ref to always get latest points, even before re-render)
      const currentDrawingPts = drawingPointsRef.current;
      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && currentDrawingPts.length > 0) {
        const lastPoint = currentDrawingPts[currentDrawingPts.length - 1];
        const offset = orthoSnapEnabledRef.current ? orthoSnapAngleOffsetRef.current : 0;
        previewPos = snapToAngle(localPos, lastPoint, offset);
      }

      // F. CLOSING DETECTION (screen-distance based, zoom-independent)
      const closingType = newAnnotation?.type;
      const canClose = (closingType === "POLYGON" || closingType === "POLYLINE") && currentDrawingPts.length >= 3;
      if (canClose) {
        const firstPt = currentDrawingPts[0];
        const pose = getTargetPose();
        const worldFirstX = firstPt.x * pose.k + pose.x;
        const worldFirstY = firstPt.y * pose.k + pose.y;
        const screenFirst = viewportRef.current?.worldToViewport(worldFirstX, worldFirstY);
        if (screenFirst) {
          const dx = viewportPos.x - screenFirst.x;
          const dy = viewportPos.y - screenFirst.y;
          const screenDist = Math.sqrt(dx * dx + dy * dy);
          const CLOSING_THRESHOLD_PX = 20;
          if (screenDist < CLOSING_THRESHOLD_PX) {
            if (!isClosingRef.current) {
              isClosingRef.current = true;
              closingMarkerRef.current?.update(screenFirst);
              // Snap preview to first point
              previewPos = firstPt;
            }
          } else {
            if (isClosingRef.current) {
              isClosingRef.current = false;
              closingMarkerRef.current?.update(null);
            }
          }
        }
      }

      lastPreviewPosRef.current = previewPos;
      drawingLayerRef.current?.updatePreview(previewPos);
    }

    // --- POLYGON DETECTION FROM ANNOTATIONS ---
    if (enabledDrawingModeRef.current === "POLYGON_CLICK") {
      const localPos = toLocalCoords(worldPos);
      runPolygonDetection(localPos, annotations, drawingPointsRef.current);
    }

    // --- LOGIQUE BRUSH ---
    if (enabledDrawingMode === "BRUSH") {
      if (event.shiftKey && event.buttons === 1) {
        // 1. Position dans l'image
        const localPos = toLocalCoords(worldPos);
        const targetPose = getTargetPose(); // Scale de l'image (ex: fit dans container)
        const currentCameraZoom = viewportRef.current?.getZoom() || 1;
        const totalScale = (targetPose.k || 1) * currentCameraZoom;
        const radiusInImage = SCREEN_BRUSH_RADIUS_PX / totalScale;
        setBrushPath(prev => [...prev, {
          x: localPos.x,
          y: localPos.y,
          r: radiusInImage
        }]);
      }
    }

    // --- LOGIQUE SMART DETECT (Optimisée) ---
    if (enabledDrawingMode === "SMART_DETECT" || showSmartDetect) {
      updateSmartDetect(lastMouseScreenPosRef.current);
    }

    // --- LOGIQUE SMART TRANSFORMER (Optimisée) ---
    if (enabledDrawingMode === "SMART_TRANSFORMER") {
      updateSmartTransformer(lastMouseScreenPosRef.current);
    }

    // --- 5. DÉTECTION DU HOVER (HIT TEST) ---
    // Le Correctif est ici : On ne cherche ce qu'il y a sous la souris 
    // QUE si on est "au repos" (!isInteracting).

    if (!isInteracting) {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hit = nativeTarget.closest?.("[data-node-type]");

      if (hit) {
        //console.log("hovered node", hit?.dataset);
        setHoveredNode(hit?.dataset);

        // Tooltip Logic
        if (tooltipData?.nodeId !== hit.dataset.nodeId) {
          setTooltipData(hit.dataset);

          // Force immediate update to avoid jump at (0,0)
          requestAnimationFrame(() => {
            if (tooltipRef.current) {
              const x = viewportPos.x + 15;
              const y = viewportPos.y + 15;
              tooltipRef.current.style.transform = `translate(${x}px, ${y}px)`;
            }
          });
        }
      } else {
        // Rien sous la souris
        setHoveredNode(null);
        if (tooltipData) setTooltipData(null);
      }
    } else {
      // Si on interagit, on s'assure de nettoyer l'état survolé
      setHoveredNode(null);
    }
  };

  // --- GESTION CLICK / DRAG ---

  const handleMarkerMouseDown = (e) => {
    // 1. Prevent Viewport Pan
    e.stopPropagation();
    e.preventDefault();
    const enabledDrawingMode = enabledDrawingModeRef.current;


    // ==================
    // Dessin
    // ==================

    const snap = currentSnapRef.current;
    console.log("[InteractionLayer] snap", snap, enabledDrawingMode);
    if (!snap) return;

    // =======================================================
    // Mode Dessin
    // =======================================================
    if (enabledDrawingMode) {

      // SPLIT at vertex: if clicking a VERTEX snap on a POLYLINE/STRIP, split immediately
      if (["CLICK", "SPLIT_CLICK"].includes(enabledDrawingMode)
        && newAnnotation?.type === "SPLIT"
        && snap.type === "VERTEX"
        && ["POLYLINE", "STRIP"].includes(snap.annotationType)
      ) {
        onCommitSplitAtVertexRef.current?.(snap.annotationId, snap.id);
        setDrawingPoints([]);
        drawingPointsRef.current = [];
        return;
      }

      // SPLIT_POLYLINE_CLICK: single-click split at snap point (via snap marker)
      if (enabledDrawingMode === "SPLIT_POLYLINE_CLICK") {
        onSplitPolylineClickPointRef.current?.(snap).then((result) => {
          if (result?.status === "split_done") {
            setSplitFlashPoint({ x: snap.x, y: snap.y });
          }
        });
        return;
      }

      // SPLIT_POLYLINE: 2-click snap-based polyline split (via snap marker)
      if (enabledDrawingMode === "SPLIT_POLYLINE") {
        const localX = snap.x;
        const localY = snap.y;
        onSplitPolylineClickRef.current?.(snap).then((result) => {
          if (result?.status === "first_point_set") {
            setDrawingPoints([{ x: localX, y: localY }]);
            drawingPointsRef.current = [{ x: localX, y: localY }];
          } else if (result?.status === "split_done") {
            setDrawingPoints([]);
            drawingPointsRef.current = [];
          }
        });
        return;
      }

      // 1. On prépare l'objet point de base
      const pointToAdd = {
        x: snap.x,
        y: snap.y,
        type: "square" // optionnel, pour l'affichage local immédiat
      };

      // 2. LOGIQUE CLÉ : Si c'est un point existant (VERTEX), on passe son ID
      if (snap.type === 'VERTEX') {
        pointToAdd.existingPointId = snap.id;
      }

      // 3. If snapping to a PROJECTION or MIDPOINT on an existing segment,
      // store metadata so the new point can be inserted into the target annotation at creation
      if ((snap.type === 'PROJECTION' || snap.type === 'MIDPOINT') && snap.previewAnnotationId) {
        pointToAdd.snapSegment = {
          annotationId: snap.previewAnnotationId,
          segmentStartId: snap.segmentStartId,
          segmentEndId: snap.segmentEndId,
          cutIndex: snap.cutIndex,
        };
      }

      // ATTENTION : setDrawingPoints est asynchrone. 
      // Pour le commit immédiat, on doit construire le tableau manuellement.

      const newPointsList = [...drawingPointsRef.current, pointToAdd];
      setDrawingPoints(newPointsList);
      drawingPointsRef.current = newPointsList; // Force ref update pour commit immédiat

      // On force un flash visuel
      screenCursorRef.current?.triggerFlash();

      // --- CORRECTION DU BUG "ONE_CLICK" ---
      if (enabledDrawingMode === 'ONE_CLICK') {
        // Si on est en mode un seul clic (Marker/Point), on commit tout de suite !
        commitPoint();
      }

      else if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "MEASURE", "SEGMENT"].includes(enabledDrawingMode) && newPointsList?.length === 2) {
        commitPolyline(e); // add "e" to get clientX & clientY to set the measurePopper anchor position.
      }

      // On s'arrête ici
      return;
    }
    // =======================================================

    // --- CAS 1 & 2 : VERTEX ou PROJECTION — délégué à usePointDrag ---
    // Inclut la logique de permission + fork automatique pour les points partagés
    handleVertexOrProjectionMouseDown(snap, e);

    //snappingLayerRef.current?.update(null); // hide snapping circle // on hide au move

    // FORCE CURSOR ON BODY
    document.body.style.cursor = 'crosshair';
  };


  // --- 3. MOUSE UP (Global) ---
  const handleMouseUp = (event) => {

    console.log("[MouseUp] lassoRect", lassoRect)
    if (lassoRect) {
      endLasso();
      return;
    }


    const dragState = dragStateRef.current;
    const dragAnnotationState = dragAnnotationStateRef.current;

    console.log('handleMouseUp_dragAnnotationState', dragAnnotationState);


    // click sur un vertex ou une annotation
    if (!dragAnnotationState?.active && dragAnnotationState?.pending) {

      const annotationId = dragAnnotationState.selectedAnnotationId;
      const annotation = annotations?.find((a) => a.id === annotationId);

      let panelAnchor = null;
      if (annotation) panelAnchor = getAnnotationEditionPanelAnchor(annotation);

      console.log("debug_2701_click_on_annotation", annotation, panelAnchor);

      const newItem = {
        id: annotationId,
        nodeId: annotationId,
        type: "NODE",
        nodeType: "ANNOTATION",
        annotationType: annotation?.type,
        entityId: annotation?.entityId,
        listingId: annotation?.listingId,
        annotationTemplateId: annotation?.annotationTemplateId,
        nodeContext: dragAnnotationState.nodeContext,
        partId: null,
        partType: null
      };

      let _selectedItems = [...selectedItems];

      if (event.shiftKey) {
        dispatch(toggleItemSelection(newItem));
        const exists = _selectedItems.find(i => i.id === newItem.id);
        if (exists) {
          _selectedItems = _selectedItems.filter(i => i.id !== newItem.id);
        } else {
          _selectedItems.push(newItem);
        }
      } else {
        _selectedItems = [newItem];
        dispatch(setSelectedItem(newItem));
        dispatch(setShowAnnotationsProperties(true));
      }

      // -- Afichage du toolbar pour édition --

      if (_selectedItems?.length > 1) {
        const _annotations = annotations.filter((a) => _selectedItems.some((s) => s.nodeId === a.id));
        const bbox = mergeBboxes(_annotations.map((a) => getAnnotationBBox(a)));
        if (bbox) {
          panelAnchor = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
          console.log("debug_151_panelAnchor", panelAnchor);
        }
      }

      if (panelAnchor) {
        // 2. Convertir LOCAL -> MONDE
        const isBgContext = annotation?.context === "BG_IMAGE";
        const pose = isBgContext ? bgPose : getTargetPose();

        const worldX = panelAnchor.x * pose.k + pose.x;
        const worldY = panelAnchor.y * pose.k + pose.y;

        // 3. Convertir MONDE -> ÉCRAN (Viewport)
        const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);

        if (_selectedItems?.length > 1) {
          dispatch(setAnnotationsToolbarPosition(screenPos));
        } else {
          console.log("debug_2701_setAnnotationToolbarPosition", screenPos);
          dispatch(
            setAnnotationToolbarPosition({ x: screenPos?.x, y: screenPos?.y })
          );
        }
      }

      // reset annotation state
      handleAnnotationDragEnd();

    }

    // BaseMap drag end — délégué à useBaseMapDrag
    handleBaseMapDragEnd();

    // Version drag end — délégué à useVersionDrag
    handleVersionDragEnd();

    // Calibration target drag end
    handleCalibrationDragEnd();

    // Legend drag end — délégué à useLegendDrag
    handleLegendDragEnd();

    // --- Point drag (VERTEX / PROJECTION) — délégué à usePointDrag ---
    if (dragState) {
      const handled = handlePointDragEnd();
      if (handled) return;
    }

    // --- Gestion du Drag d'Annotation entière — délégué à useAnnotationDrag ---
    else if (dragAnnotationState) {
      handleAnnotationDragEnd();
    }
  };


  // --- HANDLER DU CLIC SUR LE CLOSING MARKER ---
  const handleClosingClick = () => {
    const isPolyline = newAnnotation?.type === "POLYLINE";
    console.log(`Closing ${isPolyline ? "Polyline" : "Polygon"} via Marker Click`);
    isClosingRef.current = false;
    closingMarkerRef.current?.update(null);
    commitPolyline(null, isPolyline ? { closeLine: true } : undefined);
  };

  const POINT_BASED_TYPES = ["POLYLINE", "POLYGON", "STRIP"];
  const WRAPPER_NODE_ID = "wrapper";

  // Helper: get wrapper context (annotation IDs + bbox) for wrapper interactions
  const getWrapperContext = () => {
    const wrapperAnnotationIds = selectedItems
      .filter(item => POINT_BASED_TYPES.includes(item.nodeType))
      .map(item => item.nodeId);
    if (wrapperAnnotationIds.length === 0) return null;
    const wrapperAnnotations = annotations?.filter(a => wrapperAnnotationIds.includes(a.id)) ?? [];
    if (wrapperAnnotations.length === 0) return null;
    const wrapperBbox = computeWrapperBbox(wrapperAnnotations);
    return { wrapperAnnotationIds, wrapperBbox };
  };

  const handleMouseDownCapture = (e) => {

    // ==================
    // Annotation
    // ==================

    const target = e.nativeEvent?.target || e.target;

    // DEBUG
    console.log("MouseDown Target:", target);
    console.log("Is Resize?", !!target.closest('[data-interaction="resize-annotation"]'));
    console.log("Is Drag?", !!target.closest('[data-interaction="draggable"]'));
    console.log("Is Rotate?", !!target.closest('[data-interaction="rotate-annotation"]'));


    // --- permet la modif de l'input/textarea d'un label

    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
      return;
    }

    const draggableGroup = target.closest('[data-interaction="draggable"]');
    const partNode = target.closest('[data-part-type]');
    const partType = partNode?.dataset?.partType;

    const resizeHandle = target.closest('[data-interaction="resize-annotation"]');
    const basemapHandle = target.closest('[data-interaction="transform-basemap"]');
    const versionHandle = target.closest('[data-interaction="transform-version"]');
    const calibrationHandle = target.closest('[data-interaction="calibration-target"]');
    const legendHandle = target.closest('[data-interaction="transform-legend"]');
    const textHandle = target.closest('[data-interaction="transform-text"]');
    const rotateHandle = target.closest('[data-interaction="rotate-annotation"]');
    const hit = target.closest('[data-node-type]');

    // Si on ne clique sur rien ET que Shift est pressé -> Lasso

    console.log("hit", hit?.dataset, e.shiftKey)

    if ((!hit || hit?.dataset?.nodeType === "BASE_MAP") && e.shiftKey && !enabledDrawingModeRef.current) {
      const started = startLasso(e);
      if (started) {
        console.log("lasso started")
        e.stopPropagation(); // On empêche le Pan de la caméra
        // e.preventDefault(); // Optionnel selon le besoin
        return;
      }
    }


    console.log("debug_A_selectedNode", selectedNode)
    if (!selectedNode && !showBgImage && !draggableGroup && !resizeHandle && !rotateHandle && !versionHandle && !calibrationHandle) return;



    // --- Resize, Rotate, Draggable — délégué à useAnnotationDrag avec permission guard ---

    // Helper: resolve wrapper info when nodeId is "wrapper"
    const POINT_BASED_TYPES = ["POLYLINE", "POLYGON", "STRIP"];
    const resolveWrapperInfo = (nodeId, partType) => {
      if (nodeId !== "wrapper") return {};
      const wrapperAnnotationIds = selectedItems
        .filter(item => item.type === "NODE" && POINT_BASED_TYPES.includes(item.annotationType))
        .map(item => item.nodeId);
      const wrapperAnnotations = annotations?.filter(a => wrapperAnnotationIds.includes(a.id)) ?? [];

      // For ROTATE with existing rotation, use canonical bbox (un-rotated around stored center)
      // so the rotation pivot stays consistent across successive rotations.
      const cumulativeRotation = wrapperAnnotations[0]?.rotation ?? 0;
      const rotationCenter = wrapperAnnotations[0]?.rotationCenter ?? null;
      const wrapperBbox = (partType === "ROTATE" && cumulativeRotation !== 0 && rotationCenter)
        ? computeWrapperBbox(wrapperAnnotations, cumulativeRotation, rotationCenter)
        : computeWrapperBbox(wrapperAnnotations);

      return { wrapperAnnotationIds, wrapperBbox };
    };

    if (resizeHandle) {
      e.stopPropagation();
      e.preventDefault();
      const { nodeId, handleType } = resizeHandle.dataset;
      const worldPos = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
      const startMouseInLocal = toLocalCoords(worldPos);
      initAnnotationDrag({
        nodeId,
        startMouseInLocal,
        partType: `RESIZE_${handleType}`,
        startMouseScreen: { x: e.clientX, y: e.clientY },
        ...resolveWrapperInfo(nodeId, `RESIZE_${handleType}`),
      });
      return;
    }

    if (rotateHandle) {
      e.stopPropagation();
      e.preventDefault();
      const { nodeId } = rotateHandle.dataset;
      const worldPos = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
      const startMouseInLocal = toLocalCoords(worldPos);
      initAnnotationDrag({
        nodeId,
        startMouseInLocal,
        partType: "ROTATE",
        startMouseScreen: { x: e.clientX, y: e.clientY },
        ...resolveWrapperInfo(nodeId, "ROTATE"),
      });
      return;
    }

    if (draggableGroup) {
      e.stopPropagation();
      e.preventDefault();
      const { nodeId, nodeContext } = draggableGroup.dataset;
      const worldPos = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
      const startMouseInLocal = toLocalCoords(worldPos);
      initAnnotationDrag({
        nodeId,
        startMouseInLocal,
        partType,
        startMouseScreen: { x: e.clientX, y: e.clientY },
        nodeContext,
        ...resolveWrapperInfo(nodeId, partType),
      });
    }

    if (basemapHandle || legendHandle) {
      e.stopPropagation();
      e.preventDefault();

      const handleType = basemapHandle?.dataset?.handleType || legendHandle?.dataset?.handleType;

      if (basemapHandle) {
        initBaseMapDrag(handleType, e);
      }
      if (legendHandle) {
        initLegendDrag(handleType, e);
      }
      if (textHandle) {
        const startMouseWorld = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
        if (!startMouseWorld) return;
        setDragTextState({
          active: true,
          handleType,
          startMouseWorld,
          startWidth: selectedAnnotation.width,
          startX: selectedAnnotation.x,
        });
        document.body.style.cursor = handleType === 'MOVE' ? 'grabbing' : 'crosshair';
      }
    }

    if (versionHandle) {
      e.stopPropagation();
      e.preventDefault();
      const { handleType, versionId, baseMapId } = versionHandle.dataset;
      const startTransform = JSON.parse(versionHandle.dataset.versionTransform || '{"x":0,"y":0,"rotation":0,"scale":1}');
      const imageSize = JSON.parse(versionHandle.dataset.versionImageSize || '{}');
      initVersionDrag(versionId, handleType, e, startTransform, imageSize, baseMapId);
    }

    if (calibrationHandle) {
      e.stopPropagation();
      e.preventDefault();
      const { targetColor } = calibrationHandle.dataset;
      initCalibrationDrag(targetColor, e);
    }


  }

  const handleMouseLeave = () => {
    setTooltipData(null);
  };


  function handleContextMenu(e) {
    e.preventDefault();

    // Detect if clicking on a node
    const nativeTarget = e.nativeEvent?.target || e.target;
    const hit = nativeTarget.closest?.("[data-node-type]");

    if (hit) {
      const { nodeId, nodeListingId, nodeType, annotationType, pointIndex } =
        hit.dataset;
      dispatch(
        setClickedNode({
          id: nodeId,
          nodeListingId,
          nodeType,
          annotationType,
          pointIndex,
        })
      );
    } else {
      dispatch(setClickedNode(null));
    }

    // Use client coordinates for Popper anchor
    dispatch(
      setAnchorPosition({
        x: e.clientX,
        y: e.clientY,
      })
    );
  }

  // Drag n Drop

  const handleExternalImageDrop = ({ imageUrl, x, y, idMaster }) => {
    console.log("Nouvelle image dropée :", imageUrl, x, y, idMaster);
    if (onCommitImageDrop) onCommitImageDrop({ imageUrl, x, y, idMaster });
  };

  // render

  const targetPose = getTargetPose();

  // shouldDisablePan
  const shouldDisablePan = useCallback((e) => {
    if (enabledDrawingMode === 'BRUSH' && e.shiftKey) return true;
    return false;
  }, [enabledDrawingMode]);

  return (
    <Box
      onMouseUp={handleMouseUp}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      sx={{
        width: 1, height: 1, // A. Le curseur de base du conteneur
        cursor: getCursorStyle(),

        // B. L'Override "Nucléaire" pour le mode dessin
        // Si on dessine, on force TOUS les enfants (& *) à avoir crosshair
        // Sauf pour les modes de sélection de segment (pointer)
        ...(enabledDrawingMode && !SEGMENT_SELECT_MODES.includes(enabledDrawingMode) && {
          '& *': {
            cursor: 'crosshair !important',
          },
        }),
        ...(SEGMENT_SELECT_MODES.includes(enabledDrawingMode) && {
          '& *': {
            cursor: 'pointer !important',
          },
        }),
      }}>
      <MapEditorViewport
        ref={viewportRef}
        shouldDisablePan={shouldDisablePan}
        onWorldClick={handleWorldClick}
        onWorldMouseMove={handleWorldMouseMove}
        onCameraChange={handleCameraChange}
        staticOverlay={
          <><ScreenCursorV2
            ref={screenCursorRef}
            visible={(!!enabledDrawingMode && !SEGMENT_SELECT_MODES.includes(enabledDrawingMode)) || dragState?.active}
            newAnnotation={newAnnotation}
            rotationAngle={orthoSnapAngleOffset || 0}
          />
            <SnappingLayer
              ref={snappingLayerRef}
              color="#ff00ff"
              onMouseDown={handleMarkerMouseDown}
            />
            <ClosingMarker
              ref={closingMarkerRef}
              onClick={handleClosingClick}
            />
            {splitFlashPoint && (
              <svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  overflow: "visible",
                }}
              >
                <circle
                  cx={splitFlashPoint.x}
                  cy={splitFlashPoint.y}
                  r="4"
                  fill="#ff00ff"
                  opacity="0.9"
                >
                  <animate
                    attributeName="r"
                    from="4"
                    to="20"
                    dur="0.5s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.9"
                    to="0"
                    dur="0.5s"
                    fill="freeze"
                  />
                </circle>
                <circle
                  cx={splitFlashPoint.x}
                  cy={splitFlashPoint.y}
                  r="4"
                  fill="none"
                  stroke="#ff00ff"
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    from="4"
                    to="30"
                    dur="0.6s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.8"
                    to="0"
                    dur="0.6s"
                    fill="freeze"
                  />
                </circle>
              </svg>
            )}

          </>
        }
        htmlOverlay={
          <>
            <Box sx={{ position: 'absolute', bottom: "16px", left: "76px", zIndex: 1 }}>
              <HelperScale
                ref={helperScaleRef} // <--- Brancher la ref
                meterByPx={baseMapMeterByPx} // Passer la prop statique venant de baseMap
                basePoseK={basePose?.k || 1}
                initialWorldK={1}
              />
            </Box>
            {/* Render conditionally based on Data State */}
            {tooltipData && (
              <MapTooltip
                ref={tooltipRef} // Pass the Ref
                hoveredNode={tooltipData}
                annotations={annotations}
              />
            )}
          </>
        }
      >
        {/* On passe hoveredId aux enfants via Clone ou Context si besoin */}
        {/* Ou mieux : Les enfants écoutent un store/context dédié aux interactions */}
        {children}


        <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
          <TransientDetectedShapeLayer
            ref={transientDetectedShapeLayerRef}
            containerK={targetPose.k}
          />
          <TransientOrthoPathsLayer ref={transientOrthoPathsRef} />
          <TransientDetectedPolylinesLayer ref={transientDetectedPolylinesRef} />
          <TransientDetectedPolygonLayer ref={transientDetectedPolygonRef} />
        </g>

        {(dragState?.active || dragState?.frozen) && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <TransientTopologyLayer
              annotations={annotations}
              baseMapMeterByPx={baseMapMeterByPx}
              movingPointId={dragState.pointId}
              originalPointIdForDuplication={dragState.isDuplicateMode ? dragState.originalPointId : null}
              currentPos={dragState.currentPos}
              viewportScale={targetPose.k * cameraZoom}
              virtualInsertion={virtualInsertion}
              selectedAnnotationId={selectedNode?.nodeId?.replace("label::", "")}
            />
          </g>
        )}


        {/* --- Overlay optimiste : visible pendant le drag ET en attente de convergence DB --- */}
        {(() => {
          // Wrapper mode: active drag OR convergence (pending moves remain after mouseUp)
          const POINT_BASED_TYPES_T = ["POLYLINE", "POLYGON", "STRIP"];

          // Resolve wrapper annotation IDs from drag state or from pending moves
          let wrapperAnnIds = null;
          let deltaPos = null;
          let partType = null;
          let wrapperBbox = null;

          if (dragAnnotationState?.isWrapper && dragAnnotationState?.wrapperAnnotationIds) {
            // Active drag
            wrapperAnnIds = dragAnnotationState.wrapperAnnotationIds;
            deltaPos = dragAnnotationState.deltaPos ?? { x: 0, y: 0 };
            partType = dragAnnotationState.partType;
            wrapperBbox = dragAnnotationState.wrapperBbox;

            if (!dragAnnotationState.active) {
              const hasPending = wrapperAnnIds.some(id => !!getPendingMove(id));
              if (!hasPending) wrapperAnnIds = null;
            }
          } else if (!dragAnnotationState) {
            // Convergence phase: dragAnnotationState is null but pending moves remain
            const candidateIds = selectedItems
              .filter(item => item.type === "NODE" && POINT_BASED_TYPES_T.includes(item.annotationType))
              .map(item => item.nodeId);

            if (candidateIds.length > 0) {
              const firstPending = getPendingMove(candidateIds[0]);
              if (firstPending?.wrapperBbox) {
                wrapperAnnIds = candidateIds;
                deltaPos = firstPending.deltaPos;
                partType = firstPending.partType;
                wrapperBbox = firstPending.wrapperBbox;
              }
            }
          }

          if (wrapperAnnIds) {
            // For rotation, keep the canonical bbox and apply cumulative + delta rotation.
            // For other transforms, compute the bbox from transformed points.
            const isRotation = partType === "ROTATE";
            let transientWrapperBbox;
            let wrapperRotation = 0;
            let wrapperRotationCenter = null;

            const cumulativeRotation = annotations?.find(a => a.id === wrapperAnnIds[0])?.rotation ?? 0;
            const existingCenter = annotations?.find(a => a.id === wrapperAnnIds[0])?.rotationCenter ?? null;

            if (isRotation && wrapperBbox) {
              transientWrapperBbox = wrapperBbox;
              wrapperRotation = cumulativeRotation + (deltaPos?.x ?? 0);
              wrapperRotationCenter = existingCenter;
            } else {
              const transformedAnnotations = wrapperAnnIds
                .map(annId => annotations?.find(a => a.id === annId))
                .filter(Boolean)
                .map(ann => applyDeltaPosToAnnotation(ann, deltaPos, partType, wrapperBbox));

              // For MOVE on a rotated annotation, compute the canonical (un-rotated) bbox
              // using the translated rotation center, and preserve the visual rotation.
              const isMove = !partType || partType === "MOVE";
              if (isMove && cumulativeRotation !== 0 && existingCenter) {
                const translatedCenter = {
                  x: existingCenter.x + (deltaPos?.x ?? 0),
                  y: existingCenter.y + (deltaPos?.y ?? 0),
                };
                transientWrapperBbox = computeWrapperBbox(transformedAnnotations, cumulativeRotation, translatedCenter);
                wrapperRotation = cumulativeRotation;
                wrapperRotationCenter = translatedCenter;
              } else {
                transientWrapperBbox = computeWrapperBbox(transformedAnnotations);
              }
            }

            return (
              <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
                {wrapperAnnIds.map(annId => {
                  const ann = annotations?.find(a => a.id === annId);
                  if (!ann) return null;
                  return (
                    <TransientAnnotationLayer
                      key={annId}
                      annotation={ann}
                      deltaPos={deltaPos}
                      partType={partType}
                      wrapperBbox={wrapperBbox}
                      basePose={targetPose}
                      baseMapMeterByPx={baseMapMeterByPx}
                    />
                  );
                })}
                {transientWrapperBbox && (
                  <AnnotationEditingWrapper
                    bbox={transientWrapperBbox}
                    containerK={targetPose.k}
                    dragged={true}
                    rotation={wrapperRotation}
                    rotationCenter={wrapperRotationCenter}
                  />
                )}
              </g>
            );
          }

          // Single annotation mode
          const pendingMove = getPendingMove(selectedAnnotation?.id);
          const isActive = dragAnnotationState?.active || pendingMove;
          if (!isActive) return null;
          const singleDeltaPos = dragAnnotationState?.deltaPos ?? pendingMove?.deltaPos;
          const singlePartType = dragAnnotationState?.partType ?? pendingMove?.partType;
          return (
            <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
              <TransientAnnotationLayer
                annotation={selectedAnnotation}
                deltaPos={singleDeltaPos}
                partType={singlePartType}
                basePose={targetPose}
                baseMapMeterByPx={baseMapMeterByPx}
              />
            </g>
          );
        })()}

        {(enabledDrawingMode && drawingPoints.length > 0) && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <DrawingLayer
              ref={drawingLayerRef}
              points={drawingPoints}
              newAnnotation={newAnnotation}
              enabledDrawingMode={enabledDrawingMode}
              containerK={targetPose.k}
              meterByPx={baseMapMeterByPx}
            />
          </g>

        )}

        {/* Calibration targets layer */}
        <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
          <CalibrationLayer containerK={targetPose.k} />
        </g>

        {enabledDrawingMode === "BRUSH" && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            {/* Le BrushLayer doit être dans le référentiel Local (Image) pour que les coordonnées matchent */}
            {/* MAIS un Canvas HTML dans un SVG <g> ne marche pas via ForeignObject de manière fiable. */}
            {/* SOLUTION : BrushDrawingLayer doit retourner un <foreignObject> si dans SVG, 
                     OU être placé hors du SVG viewport et géré en CSS transform.
                     APPROCHE RECOMMANDÉE ICI :
                     Comme MapEditorViewport gére des enfants SVG (via <g>), 
                     on va utiliser un foreignObject pour insérer le Canvas HTML dans l'espace SVG.
                 */}
            <foreignObject
              width={baseMapImageSize?.width || 1000}
              height={baseMapImageSize?.height || 1000}
              style={{ pointerEvents: 'none' }} // Laisse passer les clics
            >
              <BrushDrawingLayer
                ref={brushLayerRef}
                width={baseMapImageSize?.width || 1000}
                height={baseMapImageSize?.height || 1000}
                brushPath={brushPath}
                color={newAnnotation?.fillColor}
              />
            </foreignObject>
          </g>
        )}

        {/* Exemple : Afficher un curseur de snapping personnalisé ici */}
        {/* <SnapCursor position={currentSnapPos} /> */}
      </MapEditorViewport>


      <>
        {/* Image source cachée */}
        <img
          ref={setSourceImageEl}
          src={baseMapImageUrl}
          style={{ display: 'none' }}
          crossOrigin="anonymous"
        />

        {/* Le composant Loupe — only render in the active viewer */}
        {zoomContainer && isActiveViewer ? createPortal(<SmartDetectLayer
          ref={smartDetectRef}
          sourceImage={sourceImageEl}
          baseMapImageScale={baseMapImageScale}
          baseMapImageOffset={baseMapImageOffset}
          rotation={rotation}
          loupeSize={LOUPE_SIZE}
          onSmartShapeDetected={handleSmartShapeDetected}
          enabled={enabledDrawingMode === 'SMART_DETECT' || showSmartDetectRef.current}
          initialDetectMode={
            ["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode) ? "RECTANGLE"
            : enabledDrawingMode === "DETECT_SIMILAR_POLYLINES" ? "SIMILAR_LINE"
            : (enabledDrawingMode === "POLYLINE_CLICK" && advancedLayout) ? "ORTHO_PATHS"
            : undefined
          }
          loupeOnly={!["POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "RECTANGLE", "SMART_DETECT", "DETECT_SIMILAR_POLYLINES"].includes(enabledDrawingMode)}
          orthoSnapAngleOffset={orthoSnapAngleOffset}
        />, zoomContainer) : null}
      </>

      {/* SmartTransformer */}
      {enabledDrawingMode === "SMART_TRANSFORMER" && <SmartTransformerLayer
        ref={smartTransformerRef}
        sourceImage={sourceImageEl}
        transformersWorker={transformersWorker}
        debug={true}
      />}
      <DialogAutoLoadingModel />

      <LassoOverlay rect={lassoRect} />

      <DropZoneLayer
        viewportRef={viewportRef}
        toLocalCoords={toLocalCoords}
        onDrop={handleExternalImageDrop}
        baseMapImageSize={baseMapImageSize}
      />

    </Box >
  );
});

export default InteractionLayer;