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
import { setImageModeLegendSelected } from 'Features/mapEditor/mapEditorSlice';
import {
  setPasteClipboard,
  clearPasteClipboard,
  rotatePasteClipboard,
  flipPasteClipboardX,
  setPasteDetectionMode,
} from 'Features/mapEditor/mapEditorSlice';
import {
  setAnchorSourceAnnotationId,
  setOrthoSnapEnabled,
  setFixedLength,
  toggleSmartDetectEnabled,
  cycleLoupeAspect,
  setSmartDetectionPresent,
  setSmartDetectMode,
  setGlobalDetectionRunning,
  setAutoOffsetsOnCommit,
} from 'Features/mapEditor/mapEditorSlice';
import { setColorToReplace } from 'Features/opencv/opencvSlice';
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
  selectSelectedPointIds,
  setSelectedPointIds,
  toggleSelectedPointId,
  clearSelectedPointIds,
  selectSelectedPartIds,
  setSelectedPartIds,
  toggleSelectedPartId,
  clearSelectedPartIds,
  setShowAnnotationsProperties
} from "Features/selection/selectionSlice";

import useResetNewAnnotation from 'Features/annotations/hooks/useResetNewAnnotation';
import useLassoSelection from 'Features/mapEditorGeneric/hooks/useLassoSelection';
import useLassoPointSelection from 'Features/annotations/hooks/useLassoPointSelection';
import getAnnotationLassoSegments from 'Features/annotations/utils/getAnnotationLassoSegments';
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

import findPolygonContaining from 'Features/geometry/utils/findPolygonContaining';
import createInnerPointService from 'Features/points/services/createInnerPointService';

import Box from '@mui/material/Box';
import MapEditorViewport from 'Features/mapEditorGeneric/components/MapEditorViewport';
import DrawingLayer from 'Features/mapEditorGeneric/components/DrawingLayer';
import PasteAnnotationPreviewLayer from 'Features/mapEditorGeneric/components/PasteAnnotationPreviewLayer';
import BrushDrawingLayer from 'Features/mapEditorGeneric/components/BrushDrawingLayer';
import ScreenCursorV2 from 'Features/mapEditorGeneric/components/ScreenCursorV2';
import SnappingLayer from 'Features/mapEditorGeneric/components/SnappingLayer';
import TransientTopologyLayer from 'Features/mapEditorGeneric/components/TransientTopologyLayer';
import TransientAnnotationLayer from 'Features/mapEditorGeneric/components/TransientAnnotationLayer';
import DropZoneLayer from 'Features/mapEditorGeneric/components/DropZoneLayer';

import TransientDetectedShapeLayer from 'Features/mapEditorGeneric/components/TransientDetectedShapeLayer';
import computeWrapperBbox from '../utils/computeWrapperBbox';
import anchorAnnotationToTarget from 'Features/annotations/services/anchorAnnotationToTarget';
import updateAnnotationService from 'Features/annotations/services/updateAnnotationService';
import AnnotationEditingWrapper from './AnnotationEditingWrapper';
import applyDeltaPosToAnnotation from 'Features/mapEditorGeneric/utils/applyDeltaPosToAnnotation';

import ClosingMarker from 'Features/mapEditorGeneric/components/ClosingMarker';
import HelperScale from 'Features/mapEditorGeneric/components/HelperScale';
import MapTooltip from 'Features/mapEditorGeneric/components/MapTooltip';
import SmartDetectLayer from 'Features/mapEditorGeneric/components/SmartDetectLayer';
import TransientOrthoPathsLayer from 'Features/mapEditorGeneric/components/TransientOrthoPathsLayer';
import TransientDetectedStripsLayer from 'Features/mapEditorGeneric/components/TransientDetectedStripsLayer';
import TransientDetectedPolygonLayer from 'Features/mapEditorGeneric/components/TransientDetectedPolygonLayer';
import TransientDetectedPatternLayer from 'Features/mapEditorGeneric/components/TransientDetectedPatternLayer';
import extractAnnotationImagePatch from 'Features/annotations/utils/extractAnnotationImagePatch';
import transformImageData from 'Features/annotations/utils/transformImageData';
import runPatternDetection from 'Features/smartDetect/utils/runPatternDetection';
import runGlobalFloorPlanDetection from 'Features/smartDetect/utils/runGlobalFloorPlanDetection';
import useCreateAnnotationsFromDetectedMatches from 'Features/annotations/hooks/useCreateAnnotationsFromDetectedMatches';
import detectPolygonFromAnnotations from 'Features/smartDetect/utils/detectPolygonFromAnnotations';
import detectStripFromLoupe from 'Features/smartDetect/utils/detectStripFromLoupe';
import buildExclusionMask from 'Features/smartDetect/utils/buildExclusionMask';
import floodFillFromLoupe from 'Features/smartDetect/utils/floodFillFromLoupe';
import traceMaskContour from 'Features/smartDetect/utils/traceMaskContour';
import orthogonalizeIfRectangle from 'Features/smartDetect/utils/orthogonalizeIfRectangle';
import {
  DEFAULT_WALL_CANDIDATES_CM,
  scoreSegmentAtWidth,
  dedupeSegmentsKeepBestScore,
} from 'Features/smartDetect/utils/autoDetectStripWidth';
import getStripePolygons from 'Features/geometry/utils/getStripePolygons';
import throttle from 'Features/misc/utils/throttle';
import CalibrationLayer from './CalibrationLayer';
import useMainBaseMap from 'Features/mapEditor/hooks/useMainBaseMap';
import LassoOverlay from 'Features/mapEditorGeneric/components/LassoOverlay';


import mergeBboxes from 'Features/misc/utils/mergeBboxes';
import snapToAngle from 'Features/mapEditor/utils/snapToAngle';
import getBestSnap from 'Features/mapEditor/utils/getBestSnap';
import getSnapModes from 'Features/mapEditor/utils/getSnapModes';
import getEffectiveDetectionMode from 'Features/mapEditor/utils/getEffectiveDetectionMode';
import getAnnotationEditionPanelAnchor from 'Features/annotations/utils/getAnnotationEditionPanelAnchor';
import pasteAnnotationService from 'Features/mapEditor/services/pasteAnnotationService';
import getAnnotationLabelPropsFromAnnotation from 'Features/annotations/utils/getAnnotationLabelPropsFromAnnotation';
import toggleSelectedNodeFunction from '../utils/toggleSelectedNode';

import { setToaster } from "Features/layout/layoutSlice";
import db from "App/db/db";
import cv from "Features/opencv/services/opencvService";
import editor from "App/editor";
import getTopMiddlePoint from 'Features/geometry/utils/getTopMiddlePoint';

import getAnnotationBBox from 'Features/annotations/utils/getAnnotationBbox';
import getAnnotationColor from 'Features/annotations/utils/getAnnotationColor';
import orthogonalizePolyline from 'Features/geometry/utils/orthogonalizePolyline';
import alignPolygonsToGrid from 'Features/geometry/utils/alignPolygonsToGrid';
import filterSurfaceDropCuts from 'Features/smartDetect/utils/filterSurfaceDropCuts';
import convexHull from 'Features/geometry/utils/convexHull';
import { setSurfaceDropPreview } from 'Features/smartDetect/smartDetectSlice';

import { useSmartZoom } from "App/contexts/SmartZoomContext";
import { useDrawingMetrics } from "App/contexts/DrawingMetricsContext";
import applyFixedLengthConstraint from "Features/mapEditorGeneric/utils/applyFixedLengthConstraint";
import useUndo from "App/db/useUndo";

// constants

const SNAP_THRESHOLD_ABSOLUTE = 12;
const DRAG_THRESHOLD_PX = 3; // Seuil de déplacement pour activer le drag
const SCREEN_BRUSH_RADIUS_PX = 12; // Rayon fixe à l'écran
const LOUPE_SIZE = 200; // Taille écran de la loupe
const LOUPE_ASPECT_RATIO = 5; // Rapport largeur/hauteur pour LANDSCAPE / PORTRAIT
const LOUPE_ASPECTS = ["SQUARE", "LANDSCAPE", "PORTRAIT"];
const SMART_ZOOM_DEFAULT = 1.0; // Facteur de grossissement par défaut
const SMART_ZOOM_MIN = 1.0;
const SMART_ZOOM_MAX = 20.0;
const MAX_FAILURES = 0; // On autorise 1 frames d'échec avant de stopper le autopan
import mergeDetectedPolyIntoDrawing from 'Features/smartDetect/utils/mergeDetectedPolyIntoDrawing';

const PAN_STEP = 30;

const PASTE_SUPPORTED_TYPES = ["POLYGON", "POLYLINE", "STRIP", "POINT", "MARKER"];

// Toggle `incoming` ids against `current`: ids not present are added, ids
// already present are removed. Used by the lasso to refine a selection without
// resetting it. Pure.
function toggleIds(current = [], incoming = []) {
  const incomingSet = new Set(incoming);
  const currentSet = new Set(current);
  const kept = current.filter((id) => !incomingSet.has(id));
  const added = incoming.filter((id) => !currentSet.has(id));
  return [...kept, ...added];
}

// Snapshot one annotation's geometry (pixel-image space) into a paste-clipboard
// item. Pure — used by the Ctrl+C handler for both single and multi selection.
function buildClipboardItem(ann) {
  const type = ann?.type;
  const item = { annotation: ann };
  if (type === "POLYGON" || type === "POLYLINE" || type === "STRIP") {
    item.basePoints = (ann.points || []).map((p) => ({
      x: p.x,
      y: p.y,
      ...(p.type ? { type: p.type } : {}),
    }));
    if (type === "POLYGON") {
      item.baseCuts = (ann.cuts || []).map((cut) => ({
        id: cut.id,
        points: (cut.points || []).map((p) => ({
          x: p.x,
          y: p.y,
          ...(p.type ? { type: p.type } : {}),
        })),
      }));
    }
    if (type === "STRIP") {
      item.stripWidthPx = ann.stripWidthPx ?? ann.width ?? null;
      item.stripOrientation = ann.stripOrientation ?? 1;
    }
  } else if (type === "POINT" || type === "MARKER") {
    const p = ann.point || ann.targetPoint;
    if (!p) return null;
    item.basePoint = { x: p.x, y: p.y };
  } else {
    return null;
  }
  return item;
}


const InteractionLayer = forwardRef(({
  children,
  isActiveViewer = true,
  enabledDrawingMode,
  newAnnotation,
  onCommitDrawing,
  onCommitGuideLine,
  onCommitSplitAtVertex,
  onCommitPointsFromSurfaceDrop,
  onCommitSimilarStrips,
  onCommitDetectedFeatures,
  onCommitImageDrop,
  onMapClickInSelectMode,
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
  onDeletePoints,
  onHideSegment,
  onRemoveCut,
  onDeleteGuideLine,
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
  onCameraChangeExternal,
  surfaceDropBarrierMask,
}
  , ref) => {
  const dispatch = useDispatch();



  // refs

  const viewportRef = useRef(null); // Ref vers la caméra
  const drawingLayerRef = useRef(null);
  const pastePreviewLayerRef = useRef(null);
  const lastPreviewPosRef = useRef(null);
  const brushLayerRef = useRef(null);
  const screenCursorRef = useRef(null);
  const snappingLayerRef = useRef(null);
  const closingMarkerRef = useRef(null);
  const helperScaleRef = useRef(null);
  // baseMapRafRef — now managed by useBaseMapDrag
  const smartDetectRef = useRef(null); // <--- REF VERS LA LOUPE
  const transientOrthoPathsRef = useRef(null);
  const detectedOrthoPathsRef = useRef(null); // current ortho detection results (image coords)
  const committedOrthoSegmentsRef = useRef([]); // accumulated committed segments for exclusion
  const transientDetectedPolygonRef = useRef(null);
  const detectedPolygonRef = useRef(null); // current polygon detection result { outerRing, cuts }
  const transientDetectedStripsRef = useRef(null);
  const detectedSimilarStripsRef = useRef(null); // { strips, sourceAnnotation }
  // Global smart-detect (A): result holder for the wall/pillar features
  // produced by runGlobalFloorPlanDetection. Cleared on commit / Escape.
  const detectedGlobalFeaturesRef = useRef(null); // { features, sourceAnnotation }
  const detectedShapeRef = useRef(null); // current rectangle detection { type, points }
  // Copy/paste pattern detection (Ctrl+C → A/S sub-modes).
  const transientDetectedPatternRef = useRef(null);
  const detectedPatternMatchesRef = useRef(null); // { matches, clipboard }
  const pasteDetectImageDataRef = useRef(null); // full source-image ImageData
  const patternPatchRef = useRef(null); // { clipboard, patch } cache
  // Uint8 mask (source-image px) of visible annotations — rebuilt after each
  // commit so committed copies progressively screen further detection.
  const patternExclusionMaskRef = useRef(null);
  // Aggregates the three detection refs into a single boolean used by
  // CardSmartDetect to flash the "Espace — Valider la détection" badge.
  const lastSmartDetectionPresentRef = useRef(false);
  const cachedDetectImageUrlRef = useRef(null);
  // STRIP_DETECTION caches: imageData of the source image + exclusion mask of visible annotations.
  // Built lazily when the tool activates so mouseMove only runs the detection algorithm.
  const stripDetectionImageDataRef = useRef(null);
  const stripDetectionExclusionMaskRef = useRef(null);
  // Last cursor (image-px) we ran detection at — used to skip redundant calls.
  const lastStripDetectCursorRef = useRef(null);
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
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const selectedPointIds = useSelector(selectSelectedPointIds);

  // PopperMapListings interaction mode (DRAW | EDIT | SELECT)
  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );

  // Computed selectedNode equivalent (first item)
  const { node: selectedNode, nodes: selectedNodes } = useSelectedNodes();

  // Copy/paste clipboard state
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const pasteTransform = useSelector((s) => s.mapEditor.pasteTransform);
  const pasteDetectionMode = useSelector((s) => s.mapEditor.pasteDetectionMode);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  // Anchor snap mode
  const anchorSourceAnnotationId = useSelector((s) => s.mapEditor.anchorSourceAnnotationId);
  const mapEditorMode = useSelector((s) => s.mapEditor.mapEditorMode);
  const orthoSnapEnabled = useSelector((s) => s.mapEditor.orthoSnapEnabled);
  const orthoSnapAngleOffset = useSelector((s) => s.mapEditor.orthoSnapAngleOffset);
  const stripDetectionMultiple = useSelector((s) => s.mapEditor.stripDetectionMultiple);
  const smartDetectEnabled = useSelector((s) => s.mapEditor.smartDetectEnabled);
  const smartDetectMode = useSelector((s) => s.mapEditor.smartDetectMode);
  const globalDetectionRunning = useSelector((s) => s.mapEditor.globalDetectionRunning);
  const autoOffsetsOnCommit = useSelector((s) => s.mapEditor.autoOffsetsOnCommit);
  const loupeAspectRedux = useSelector((s) => s.mapEditor.loupeAspect);
  // Strip detection orientation is now derived from the loupe aspect (set via F):
  // LANDSCAPE → "H", PORTRAIT → "V", SQUARE → "H" (fallback). The standalone
  // orientation control + O shortcut were removed because the underlying algo
  // is sufficiently driven by the loupe format alone.
  const stripDetectionOrientation = loupeAspectRedux === "PORTRAIT" ? "V" : "H";
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const rawDetection = useSelector((s) => s.smartDetect.rawDetection);
  const noCuts = useSelector((s) => s.smartDetect.noCuts);
  const noSmallCuts = useSelector((s) => s.smartDetect.noSmallCuts);
  const convexHullEnabled = useSelector((s) => s.smartDetect.convexHull);
  const visibleAreaOnly = useSelector((s) => s.smartDetect.visibleAreaOnly);
  const { zoomContainer } = useSmartZoom();
  const {
    segmentLengthPxRef,
    constraintBuffer,
    appendToBuffer,
    deleteFromBuffer,
    clearBuffer,
    rectX,
    rectY,
    rectMetricsRef,
    rectCurrentAxisRef,
    setRectHasFirstPoint,
    setRectAxis,
    appendToRectBuffer,
    toggleRectBufferSign,
    deleteFromRectBuffer,
    clearRectBuffers,
  } = useDrawingMetrics();

  const fixedLength = useSelector((s) => s.mapEditor.fixedLength);
  const fixedLengthRef = useRef(fixedLength);
  useEffect(() => { fixedLengthRef.current = fixedLength; }, [fixedLength]);

  const meterByPxRef = useRef(baseMapMeterByPx);
  useEffect(() => { meterByPxRef.current = baseMapMeterByPx; }, [baseMapMeterByPx]);

  // Sync constraint buffer → Redux fixedLength
  useEffect(() => {
    const num = parseFloat(constraintBuffer);
    if (Number.isFinite(num) && num > 0) {
      dispatch(setFixedLength(num));
      fixedLengthRef.current = num;
    } else {
      dispatch(setFixedLength(null));
      fixedLengthRef.current = null;
    }
  }, [constraintBuffer, dispatch]);

  // Clear constraint buffer when drawing mode changes (start/stop drawing)
  useEffect(() => {
    clearBuffer();
    dispatch(setFixedLength(null));
  }, [enabledDrawingMode, clearBuffer, dispatch]);

  // Clear rectangle X/Y typed buffers when drawing mode changes
  useEffect(() => {
    clearRectBuffers();
  }, [enabledDrawingMode, clearRectBuffers]);

  // Re-trigger preview when typed X/Y dimensions change so the rectangle
  // adopts the typed value without requiring a mouse move.
  useEffect(() => {
    if (lastPreviewPosRef.current && drawingLayerRef.current) {
      drawingLayerRef.current.updatePreview(lastPreviewPosRef.current);
    }
  }, [rectX, rectY]);

  // Re-computes smartDetectionPresent from the three detection refs and
  // dispatches only when the aggregate boolean changes (dedup).
  const syncSmartDetectionPresent = () => {
    const present = !!(
      detectedShapeRef.current ||
      detectedPolygonRef.current ||
      detectedSimilarStripsRef.current ||
      detectedGlobalFeaturesRef.current ||
      detectedPatternMatchesRef.current
    );
    if (present !== lastSmartDetectionPresentRef.current) {
      lastSmartDetectionPresentRef.current = present;
      dispatch(setSmartDetectionPresent(present));
    }
  };

  // Listen for similar-strip detection results from toolbar button
  useEffect(() => {
    const handler = (e) => {
      const { strips, sourceAnnotation } = e.detail;
      detectedSimilarStripsRef.current = { strips, sourceAnnotation };
      syncSmartDetectionPresent();
      transientDetectedStripsRef.current?.updateStrips(strips);
    };
    window.addEventListener('detectedSimilarStrips', handler);
    return () => window.removeEventListener('detectedSimilarStrips', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    syncSmartDetectionPresent();
    if (result) {
      transientDetectedPolygonRef.current?.updatePolygon(result);
    } else {
      transientDetectedPolygonRef.current?.clear();
    }
  }, 120), []);

  // Stable refs for image transform values, so the throttled detection function below
  // doesn't get re-created on every parent render (which would reset the throttle timer).
  const baseMapImageScaleRef = useRef(baseMapImageScale);
  useEffect(() => { baseMapImageScaleRef.current = baseMapImageScale; }, [baseMapImageScale]);
  const baseMapImageOffsetRef = useRef(baseMapImageOffset);
  useEffect(() => { baseMapImageOffsetRef.current = baseMapImageOffset; }, [baseMapImageOffset]);

  // throttled strip/segment detection from loupe — created ONCE. Driven by
  // the unified smart-detect switch:
  //   - STRIP          + smart → points on the wall edge, STRIP annotations,
  //                              preview polygon via getStripePolygons.
  //   - POLYLINE_CLICK + smart → points on the wall median axis, POLYLINE
  //                              annotations, preview polygon as a symmetric
  //                              stroke quad around the centerline.
  const runStripDetectionFromLoupe = useMemo(
    () => throttle((cursorImgPx, loupeBBox) => {
      const imageData = stripDetectionImageDataRef.current;
      if (!imageData) return;
      const na = newAnnotationRef.current;
      if (!na) return;

      const mode = enabledDrawingModeRef.current;
      // POLYLINE_CLICK + smart → centerline points (SEGMENT detection target);
      // STRIP + smart → edge points (STRIP detection target).
      const isSegmentMode = mode === "POLYLINE_CLICK";

      // Reference strip width comes from the active annotation template (newAnnotation).
      const templateStrokeWidth = na.strokeWidth ?? 20;
      const templateStrokeWidthUnit = na.strokeWidthUnit ?? "PX";
      const meterByPx = meterByPxRef.current ?? 0;
      const imageScale = baseMapImageScaleRef.current || 1;
      const imageOffset = baseMapImageOffsetRef.current || { x: 0, y: 0 };
      const templateStripWidthPx =
        templateStrokeWidthUnit === "CM" && meterByPx > 0
          ? Math.abs((templateStrokeWidth * 0.01) / meterByPx / imageScale)
          : Math.abs(templateStrokeWidth / imageScale);

      const stripOrientation = na.stripOrientation ?? 1;
      const orientation = stripDetectionOrientationRef.current || "H";
      // Negate so a positive ortho snap offset rotates the scan frame the
      // same way as snapToAngle (Features/mapEditor/utils/snapToAngle.js) and
      // the rectangle / rotated-rect snap utilities (getPolylinePointsFromRectangle.js,
      // mapEditorGeneric/DrawingLayer.jsx) — screen coords with Y pointing down.
      const orthoAngleRad =
        (-(orthoSnapAngleOffsetRef.current || 0) * Math.PI) / 180;
      const detectMultiple = !!stripDetectionMultipleRef.current;

      // Auto-detect wall width PER SEGMENT when the template does NOT override
      // strokeWidth (unit must be CM and scale must be set). We run
      // detectStripFromLoupe once for each candidate width
      // (DEFAULT_WALL_CANDIDATES_CM = [10, 15, 20, 25, 30]) in median-axis
      // mode, score each returned segment at its candidate width via
      // scoreSegmentAtWidth (dark − light pixels in a band of that width),
      // dedupe spatially, and keep the best-scoring version per wall. Each
      // kept segment carries its own strokeWidth into both the preview
      // polygon and the commit.
      //
      // When the template overrides strokeWidth (or unit is PX / no scale),
      // behaviour is unchanged: one detection run at the template's width.
      //
      // `normalForMeasure` formula MUST match getOrthoVectors in
      // detectStripFromLoupe.js (H: n=(-sin,cos), V: n=(-cos,-sin)).
      const _cosA = Math.cos(orthoAngleRad);
      const _sinA = Math.sin(orthoAngleRad);
      const normalForMeasure =
        orientation === "V"
          ? { dx: -_cosA, dy: -_sinA }
          : { dx: -_sinA, dy: _cosA };

      const overrideFields = Array.isArray(na.overrideFields)
        ? na.overrideFields
        : [];
      const isWidthAuto =
        !overrideFields.includes("strokeWidth") &&
        templateStrokeWidthUnit === "CM" &&
        meterByPx > 0;

      // Build the list of detection runs: one per candidate width in auto
      // mode, a single template-driven run otherwise.
      const runs = [];
      if (isWidthAuto) {
        const cmToPx = (cm) => Math.abs((cm * 0.01) / meterByPx / imageScale);
        for (const cm of DEFAULT_WALL_CANDIDATES_CM) {
          const px = cmToPx(cm);
          if (Number.isFinite(px) && px >= 1) {
            runs.push({ widthCm: cm, widthPx: px, onMedian: true });
          }
        }
      } else if (
        Number.isFinite(templateStripWidthPx) &&
        templateStripWidthPx >= 1
      ) {
        runs.push({
          widthCm: null,
          widthPx: templateStripWidthPx,
          onMedian: isSegmentMode,
        });
      }
      if (runs.length === 0) return;

      // Run detection for each candidate width. Collect segments with their
      // scores (score = 0 when not auto-detecting, since no comparison).
      //
      // In auto mode we pass `detectMultiple: true` to every run so each run
      // emits all parallel lines it sees — otherwise each run independently
      // picks its own "closest axis" and the final merge ends up with one
      // segment per width on DIFFERENT axes. The user-facing "detect
      // multiple" flag is re-applied globally after the dedup below.
      const perRunDetectMultiple = isWidthAuto ? true : detectMultiple;
      const allDetections = [];
      for (const { widthCm, widthPx, onMedian } of runs) {
        let results;
        try {
          results = detectStripFromLoupe({
            imageData,
            cursor: cursorImgPx,
            loupeBBox,
            stripWidthPx: widthPx,
            orientation,
            orthoAngleRad,
            stripOrientation,
            detectMultiple: perRunDetectMultiple,
            exclusionMask: stripDetectionExclusionMaskRef.current,
            pointsOnMedianAxis: onMedian,
          });
        } catch (err) {
          console.error(
            `[${mode}] detection error (width=${widthCm ?? "template"}):`,
            err
          );
          continue;
        }
        if (!results) continue;
        for (const r of results) {
          for (const seg of r.segments) {
            const score = isWidthAuto
              ? scoreSegmentAtWidth({
                  segment: seg,
                  widthPx,
                  imageData,
                  normal: normalForMeasure,
                  exclusionMask: stripDetectionExclusionMaskRef.current,
                })
              : 0;
            allDetections.push({ seg, widthCm, widthPx, score, onMedian });
          }
        }
      }

      if (allDetections.length === 0) {
        detectedSimilarStripsRef.current = null;
        syncSmartDetectionPresent();
        transientDetectedStripsRef.current?.clear();
        return;
      }

      // Auto mode: dedupe overlapping segments across candidate runs, keep
      // the best-scoring version per spatial group.
      let kept = isWidthAuto
        ? dedupeSegmentsKeepBestScore(allDetections)
        : allDetections;

      // Re-apply the user-facing "detect multiple" flag globally in auto mode.
      // We overrode it to `true` per-run above so each run could emit every
      // parallel axis; now we filter down to the single axis closest to the
      // cursor. Segments on that axis (multiple parts of the same wall
      // separated by openings) are all kept.
      if (isWidthAuto && !detectMultiple && kept.length > 1) {
        const vOf = (det) => {
          const mx = (det.seg.start.x + det.seg.end.x) / 2;
          const my = (det.seg.start.y + det.seg.end.y) / 2;
          return (
            (mx - cursorImgPx.x) * normalForMeasure.dx +
            (my - cursorImgPx.y) * normalForMeasure.dy
          );
        };
        const withV = kept.map((d) => ({ det: d, v: vOf(d) }));
        const minAbsV = withV.reduce(
          (m, x) => Math.min(m, Math.abs(x.v)),
          Infinity
        );
        // Same-axis tolerance: refinement noise + a small margin. 5 px is
        // enough in practice (refinement shifts are ≤ 1-2 px sub-pixel).
        const AXIS_TOL_PX = 5;
        kept = withV
          .filter((x) => Math.abs(Math.abs(x.v) - minAbsV) <= AXIS_TOL_PX)
          .map((x) => x.det);
      }

      // Auto mode produces median-axis segments (onMedian=true). For STRIP
      // mode we re-apply the edge-shift per segment using the selected
      // widthPx, so the committed centerline lands on the wall edge (STRIP
      // convention). detectStripFromLoupe uses stripOrientation=1 in median
      // mode — match that here.
      const finalDetections = kept.map((det) => {
        if (!det.onMedian || isSegmentMode) return det;
        const so = 1;
        const shift = -so * (det.widthPx / 2);
        return {
          ...det,
          seg: {
            start: {
              x: det.seg.start.x + shift * normalForMeasure.dx,
              y: det.seg.start.y + shift * normalForMeasure.dy,
            },
            end: {
              x: det.seg.end.x + shift * normalForMeasure.dx,
              y: det.seg.end.y + shift * normalForMeasure.dy,
            },
          },
          stripOrientation: so,
        };
      });

      const toLocal = (p) => ({
        x: p.x * imageScale + imageOffset.x,
        y: p.y * imageScale + imageOffset.y,
      });

      const strips = [];
      for (const det of finalDetections) {
        const localCenterline = [toLocal(det.seg.start), toLocal(det.seg.end)];

        // Per-strip stroke width — used for the preview polygon AND stored
        // on the strip so useCreateAnnotationsFromDetectedStrips picks it up
        // at commit. In non-auto mode, widthCm is null → strip inherits
        // template strokeWidth unchanged.
        const detStrokeWidth =
          det.widthCm != null ? det.widthCm : templateStrokeWidth;
        const detStrokeWidthUnit =
          det.widthCm != null ? "CM" : templateStrokeWidthUnit;
        const strokeWidthLocal =
          detStrokeWidthUnit === "CM" && meterByPx > 0
            ? (detStrokeWidth * 0.01) / meterByPx
            : detStrokeWidth;

        let polygon;
        let segStripOrientation;

        if (isSegmentMode) {
          // Symmetric quad around the 2-point centerline.
          const [a, b] = localCenterline;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy);
          if (len === 0) continue;
          const nx = -dy / len;
          const ny = dx / len;
          const halfW = Math.abs(strokeWidthLocal) / 2;
          polygon = [
            { x: a.x + nx * halfW, y: a.y + ny * halfW },
            { x: b.x + nx * halfW, y: b.y + ny * halfW },
            { x: b.x - nx * halfW, y: b.y - ny * halfW },
            { x: a.x - nx * halfW, y: a.y - ny * halfW },
          ];
        } else {
          // STRIP: fakeAnnotation carries this strip's own stroke width so
          // getStripePolygons renders the preview at the detected thickness.
          segStripOrientation =
            det.stripOrientation ??
            det.seg.stripOrientation ??
            na.stripOrientation;
          const fakeAnnotation = {
            ...na,
            strokeWidth: detStrokeWidth,
            strokeWidthUnit: detStrokeWidthUnit,
            stripOrientation: segStripOrientation,
            points: localCenterline,
          };
          const polys = getStripePolygons(fakeAnnotation, meterByPx);
          polygon = polys?.[0]?.points || [];
        }

        const strip = { centerline: localCenterline, polygon };
        if (!isSegmentMode) strip.stripOrientation = segStripOrientation;
        // Per-strip strokeWidth override — consumed by
        // useCreateAnnotationsFromDetectedStrips.
        if (det.widthCm != null) {
          strip.strokeWidth = det.widthCm;
          strip.strokeWidthUnit = "CM";
        }
        strips.push(strip);
      }

      if (strips.length === 0) {
        detectedSimilarStripsRef.current = null;
        syncSmartDetectionPresent();
        transientDetectedStripsRef.current?.clear();
        return;
      }
      detectedSimilarStripsRef.current = { strips, sourceAnnotation: na };
      syncSmartDetectionPresent();
      transientDetectedStripsRef.current?.updateStrips(strips);
    }, 80),
    []
  );

  // SURFACE_DROP flood-fill runner — rAF-throttled, runs on the main
  // thread using the precomputed full-image barrier mask (luminance +
  // annotations) and bounded to the rotated loupe rectangle.
  const runSurfaceDropFloodFill = (cursorImgPx, loupeBBox) => {
    if (surfaceDropRafRef.current) return; // already scheduled
    surfaceDropRafRef.current = requestAnimationFrame(() => {
      surfaceDropRafRef.current = 0;
      const barrier = surfaceDropBarrierMaskRef.current;
      if (!barrier) return;

      const orthoAngleRad =
        (-(orthoSnapAngleOffsetRef.current || 0) * Math.PI) / 180;

      const fill = floodFillFromLoupe({
        luminanceMask: barrier.luminanceMask,
        annotationsMask: barrier.annotationsMask,
        imgWidth: barrier.width,
        imgHeight: barrier.height,
        seed: cursorImgPx,
        loupeBBox,
        orthoAngleRad,
      });
      if (!fill) {
        if (surfaceDropPreviewImgPxRef.current) {
          surfaceDropPreviewImgPxRef.current = null;
          dispatch(setSurfaceDropPreview(null));
        }
        return;
      }

      const rawContourImgPx = traceMaskContour({
        mask: fill.mask,
        width: fill.width,
        height: fill.height,
        offsetX: fill.offsetX,
        offsetY: fill.offsetY,
      });
      if (rawContourImgPx.length < 3) {
        if (surfaceDropPreviewImgPxRef.current) {
          surfaceDropPreviewImgPxRef.current = null;
          dispatch(setSurfaceDropPreview(null));
        }
        return;
      }

      // POST-PROCESSING: if the contour is close to a rectangle in the
      // ortho frame, snap to that rectangle's 4 corners. The ortho angle
      // is the same one driving the loupe rotation (orthoSnapAngleOffset),
      // negated here to match screen-Y-down convention (see strip
      // detection at line ~402).
      const contourImgPx = orthogonalizeIfRectangle(
        rawContourImgPx,
        orthoAngleRad
      );

      surfaceDropPreviewImgPxRef.current = contourImgPx;
      // Convert image-pixel contour → local map coords for the SVG layer.
      const scale = baseMapImageScaleRef.current || 1;
      const offset = baseMapImageOffsetRef.current || { x: 0, y: 0 };
      const localPoints = contourImgPx.map((p) => ({
        x: p.x * scale + offset.x,
        y: p.y * scale + offset.y,
      }));
      dispatch(setSurfaceDropPreview({ points: localPoints }));
    });
  };

  // sourceImage for smart detect

  const [sourceImageEl, setSourceImageEl] = useState(null);


  // Latest annotations snapshot for STRIP_DETECTION (read at build time only).
  // Assigned in the render body (not via useEffect) so it's updated
  // synchronously as soon as the parent re-renders with the post-commit
  // annotations from useAnnotationsV2 — the previous useEffect-based sync
  // could lag one render behind when annotationsUpdatedAt fired before
  // useLiveQuery had re-emitted, causing buildExclusionMask to miss freshly
  // committed annotations.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // Use annotationsUpdatedAt (Redux) as the rebuild trigger. The effect
  // schedules buildCaches via setTimeout(0), which runs AFTER the current
  // tick's microtasks — by then useAnnotationsV2's useLiveQuery has
  // re-emitted and `annotationsRef.current` (updated synchronously in the
  // render body below) carries the fresh post-commit list.
  const annotationsUpdatedAt = useSelector((s) => s.annotations.annotationsUpdatedAt);

  // Build / clear STRIP_DETECTION / SEGMENT_DETECTION caches when the tool
  // activates / deactivates, or when the annotations list changes. Heavy
  // work (full-image getImageData + exclusion mask rasterize) is deferred
  // via setTimeout so the click activating the tool isn't blocked.
  useEffect(() => {
    const detectionTarget = getEffectiveDetectionMode({
      enabledDrawingMode,
      smartDetectEnabled,
    });
    const needsLoupeStripCaches =
      detectionTarget === "STRIP" || detectionTarget === "SEGMENT";
    if (!needsLoupeStripCaches) {
      stripDetectionImageDataRef.current = null;
      stripDetectionExclusionMaskRef.current = null;
      lastStripDetectCursorRef.current = null;
      return;
    }
    if (!sourceImageEl) return;

    let cancelled = false;
    const buildCaches = () => {
      if (cancelled) return;
      try {
        const w = sourceImageEl.naturalWidth || sourceImageEl.width;
        const h = sourceImageEl.naturalHeight || sourceImageEl.height;
        if (!w || !h) return;
        // Build ImageData only if missing (it doesn't change unless source image changes).
        if (!stripDetectionImageDataRef.current) {
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(sourceImageEl, 0, 0);
          if (cancelled) return;
          stripDetectionImageDataRef.current = ctx.getImageData(0, 0, w, h);
        }

        if (cancelled) return;
        const meterByPx = meterByPxRef.current ?? 0;
        stripDetectionExclusionMaskRef.current = buildExclusionMask(
          annotationsRef.current || [],
          { width: w, height: h },
          baseMapImageScaleRef.current,
          baseMapImageOffsetRef.current,
          meterByPx,
          null,
        );
      } catch (err) {
        console.error("[STRIP_DETECTION] failed to build caches:", err);
      }
    };
    const id = setTimeout(buildCaches, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [enabledDrawingMode, smartDetectEnabled, sourceImageEl, annotationsUpdatedAt]);

  // Copy/paste pattern detection: build the full source-image ImageData once
  // when a paste detection sub-mode is active (cleared otherwise). Same lazy
  // setTimeout pattern as the STRIP cache so the keypress isn't blocked.
  useEffect(() => {
    if (
      pasteClipboard?.items?.length !== 1 ||
      !pasteDetectionMode ||
      !sourceImageEl
    ) {
      pasteDetectImageDataRef.current = null;
      patternPatchRef.current = null;
      return;
    }
    if (pasteDetectImageDataRef.current) return;
    let cancelled = false;
    const build = () => {
      if (cancelled) return;
      try {
        const w = sourceImageEl.naturalWidth || sourceImageEl.width;
        const h = sourceImageEl.naturalHeight || sourceImageEl.height;
        if (!w || !h) return;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(sourceImageEl, 0, 0);
        if (cancelled) return;
        pasteDetectImageDataRef.current = ctx.getImageData(0, 0, w, h);
      } catch (err) {
        console.error("[patternDetection] failed to build ImageData:", err);
      }
    };
    const id = setTimeout(build, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [pasteClipboard, pasteDetectionMode, sourceImageEl]);

  // Visible annotations act as a "screen": rasterize them into an
  // exclusion mask so detection skips already-covered areas. Rebuilt when
  // the annotations change (annotationsUpdatedAt) — i.e. after every
  // bulk commit — so each validated copy progressively masks the image.
  // Reuses the same util/coords as STRIP detection (buildExclusionMask).
  useEffect(() => {
    if (
      pasteClipboard?.items?.length !== 1 ||
      !pasteDetectionMode ||
      !sourceImageEl
    ) {
      patternExclusionMaskRef.current = null;
      return;
    }
    let cancelled = false;
    const build = () => {
      if (cancelled) return;
      try {
        const w = sourceImageEl.naturalWidth || sourceImageEl.width;
        const h = sourceImageEl.naturalHeight || sourceImageEl.height;
        if (!w || !h) return;
        patternExclusionMaskRef.current = buildExclusionMask(
          annotationsRef.current || [],
          { width: w, height: h },
          baseMapImageScaleRef.current || 1,
          baseMapImageOffsetRef.current || { x: 0, y: 0 },
          meterByPxRef.current ?? 0,
          pasteClipboard?.items?.[0]?.annotation?.id ?? null,
        );
      } catch (err) {
        console.error("[patternDetection] failed to build exclusion mask:", err);
      }
    };
    const id = setTimeout(build, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [pasteClipboard, pasteDetectionMode, sourceImageEl, annotationsUpdatedAt]);

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
    getCameraMatrix: () => {
      if (viewportRef.current) {
        return viewportRef.current.getCameraMatrix();
      }
      return { x: 0, y: 0, k: 1 };
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

  useEffect(() => {
    selectedAnnotationForCopyRef.current = selectedAnnotation;
  }, [selectedAnnotation]);

  // Resolve the FULL set of selected annotations for Ctrl+C: multi-selection
  // items (shift-click / lasso) unioned with the single-selection fallback,
  // deduped by id. Drives multi-annotation copy.
  const selectedAnnotationsForCopy = useMemo(() => {
    const byId = new Map();
    // Resolve each selection item by its nodeId against annotations. This is
    // convention-agnostic: shift-click sets nodeType "ANNOTATION" while lasso
    // sets nodeType to the annotation's own type (e.g. "POLYGON") — resolving
    // by id catches both, and non-annotation nodes (base map, bg image) simply
    // won't match an annotation id.
    for (const item of selectedItems || []) {
      if (!item?.nodeId) continue;
      const ann = annotations?.find((a) => a.id === item.nodeId);
      if (ann) byId.set(ann.id, ann);
    }
    if (selectedAnnotation?.id && !byId.has(selectedAnnotation.id)) {
      byId.set(selectedAnnotation.id, selectedAnnotation);
    }
    return Array.from(byId.values());
  }, [selectedItems, annotations, selectedAnnotation]);

  useEffect(() => {
    selectedAnnotationsForCopyRef.current = selectedAnnotationsForCopy;
  }, [selectedAnnotationsForCopy]);

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


  const handleSmartShapeDetected = (shape) => {
    // shape: { type: 'POINT'|'LINE'|'RECTANGLE', points: [] } ou null
    detectedShapeRef.current = shape;
    syncSmartDetectionPresent();

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
    onCameraChangeExternal?.(cameraMatrix);

    // pour MAJ de l'image affichée dans la smart detect
    if (enabledDrawingModeRef.current === "SMART_DETECT" || showSmartDetectRef.current) {
      updateSmartDetect(lastMouseScreenPosRef.current);
    }

    // STRIP / SEGMENT auto-detection: re-run detection after a camera
    // change (arrow-key pan, drag pan, zoom). updateSmartDetect above has
    // refreshed lastSmartROI synchronously; we defer to the next frame so the
    // loupe preview has visually updated before the detection runs (the user
    // wants to "see" the new map content before the strips are recomputed).
    const _detTargetCam = getEffectiveDetectionMode({
      enabledDrawingMode: enabledDrawingModeRef.current,
      smartDetectEnabled: smartDetectEnabledRef.current,
    });
    if (_detTargetCam === "STRIP" || _detTargetCam === "SEGMENT") {
      requestAnimationFrame(() => {
        const roi = lastSmartROI.current;
        if (!roi) return;
        const cursorImgPx = {
          x: roi.x + roi.width / 2,
          y: roi.y + roi.height / 2,
        };
        lastStripDetectCursorRef.current = cursorImgPx;
        runStripDetectionFromLoupe(cursorImgPx, {
          x: roi.x, y: roi.y, width: roi.width, height: roi.height,
        });
      });
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
  // Drawing modes whose action is a single click on existing geometry — show a
  // pointer cursor and hide the ScreenCursor crosshair.
  const POINTER_CLICK_MODES = [...SEGMENT_SELECT_MODES, "REASSIGN_TEMPLATE"];
  const NO_SMART_DETECT_MODES = [...SEGMENT_SELECT_MODES, "SPLIT_POLYLINE", "SPLIT_POLYLINE_CLICK", "COMPLETE_ANNOTATION"];

  const [showSmartDetect, setShowSmartDetect] = useState(false);
  const showSmartDetectRef = useRef(showSmartDetect);
  const smartZoomRef = useRef(SMART_ZOOM_DEFAULT);
  // Loupe aspect is now driven by Redux (s.mapEditor.loupeAspect). The ref
  // mirrors it for use inside hot paths (updateSmartDetect, getLoupeScreenSize).
  // The sync effect is declared further down — right after refreshSmartDetectZoom
  // is defined — so it can trigger a ROI rebuild on aspect change.
  const loupeAspectRef = useRef(loupeAspectRedux); // "SQUARE" | "LANDSCAPE" | "PORTRAIT"
  useEffect(() => {
    const show = Boolean(enabledDrawingMode) && !NO_SMART_DETECT_MODES.includes(enabledDrawingMode);
    //showSmartDetectRef.current = showSmartDetect;
    showSmartDetectRef.current = show;
  }, [showSmartDetect, enabledDrawingMode])

  const getLoupeScreenSize = () => {
    const a = loupeAspectRef.current;
    if (a === "LANDSCAPE") return { width: LOUPE_SIZE, height: LOUPE_SIZE / LOUPE_ASPECT_RATIO };
    if (a === "PORTRAIT") return { width: LOUPE_SIZE / LOUPE_ASPECT_RATIO, height: LOUPE_SIZE };
    return { width: LOUPE_SIZE, height: LOUPE_SIZE };
  };



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

    const smartZoom = smartZoomRef.current;
    const { width: loupeW, height: loupeH } = getLoupeScreenSize();
    const sourceWidthInImage = (loupeW / smartZoom) / totalScale;
    const sourceHeightInImage = (loupeH / smartZoom) / totalScale;

    // Zoom square is in screen/viewport pixels (staticOverlay is outside camera group).
    // Hide the helper rectangle when smart detect is off — we set size to 0 so
    // the SVG rect collapses and nothing is drawn on the map.
    if (smartDetectEnabledRef.current) {
      screenCursorRef.current?.setZoomSquareSize({ width: loupeW / smartZoom, height: loupeH / smartZoom });
    } else {
      screenCursorRef.current?.setZoomSquareSize({ width: 0, height: 0 });
    }

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
      // Only run OpenCV analysis when the effective detection target is
      // RECTANGLE (STRIP / SEGMENT / SURFACE have their own pipelines).
      const detTarget = getEffectiveDetectionMode({
        enabledDrawingMode: enabledDrawingModeRef.current,
        smartDetectEnabled: smartDetectEnabledRef.current,
      });
      const runsOpenCV =
        detTarget === "RECTANGLE" ||
        enabledDrawingModeRef.current === "SMART_DETECT";
      const skipAnalysis = !runsOpenCV;
      smartDetectRef.current.update(viewportPos, sourceROI, { skipAnalysis });
    }

    lastSmartROI.current = { ...sourceROI, zoomFactor: smartZoom, totalScale };
  }, [toLocalCoords, getTargetPose, baseMapImageScale]);

  // Ref wrapper so the keyDown handler (registered once with [] deps) always
  // calls the latest closure — otherwise stale `baseMapImageScale` from the
  // first render would produce an incorrect ROI when P / M / F is pressed.
  const refreshSmartDetectZoomRef = useRef(() => {});
  refreshSmartDetectZoomRef.current = () => {
    const prev = lastSmartROI.current;
    if (!prev || !smartDetectRef.current) return;

    const newZoom = smartZoomRef.current;
    const { width: loupeWR, height: loupeHR } = getLoupeScreenSize();

    // Rebuild the ROI fresh from the current loupe size + zoom so both
    // zoom changes (P/M) and aspect-ratio changes (F) are handled.
    const imageScale = baseMapImageScaleRef.current || 1;
    const centerX = prev.x + prev.width / 2;
    const centerY = prev.y + prev.height / 2;
    const newWidth = (loupeWR / newZoom) / prev.totalScale / imageScale;
    const newHeight = (loupeHR / newZoom) / prev.totalScale / imageScale;

    const sourceROI = {
      x: centerX - newWidth / 2,
      y: centerY - newHeight / 2,
      width: newWidth,
      height: newHeight,
    };

    if (smartDetectEnabledRef.current) {
      screenCursorRef.current?.setZoomSquareSize({ width: loupeWR / newZoom, height: loupeHR / newZoom });
    } else {
      screenCursorRef.current?.setZoomSquareSize({ width: 0, height: 0 });
    }

    const viewportPos = lastMouseScreenPosRef.current?.viewportPos;
    if (viewportPos) {
      smartDetectRef.current.update(viewportPos, sourceROI, { skipAnalysis: false, forceAnalysis: true });
    }

    lastSmartROI.current = { ...sourceROI, zoomFactor: newZoom, totalScale: prev.totalScale };
  };
  const refreshSmartDetectZoom = (...args) => refreshSmartDetectZoomRef.current(...args);

  // Sync Redux loupe aspect → ref, and rebuild the ROI so the visual
  // updates immediately (card button click, F shortcut).
  useEffect(() => {
    loupeAspectRef.current = loupeAspectRedux;
    refreshSmartDetectZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loupeAspectRedux]);

  // When smart detect is toggled, refresh the loupe ROI helper rectangle —
  // it must appear/disappear on the map without waiting for mouse movement.
  useEffect(() => {
    if (smartDetectEnabled) {
      refreshSmartDetectZoom();
    } else {
      screenCursorRef.current?.setZoomSquareSize({ width: 0, height: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartDetectEnabled]);


  // Lasso selection
  function handleLassoSelection({ annotationIds, selectionBox, anchorPosition }) {
    const buildItem = (id) => {
      const ann = annotations.find((a) => a.id === id);
      return {
        id,
        nodeId: id,
        type: "NODE",
        nodeType: "ANNOTATION",
        annotationType: ann?.type,
        entityId: ann?.entityId,
        listingId: ann?.listingId,
        annotationTemplateId: ann?.annotationTemplateId,
        pointId: null,
        partId: null,
        partType: null,
      };
    };
    // Toggle the lasso hits against the current selection: annotations not yet
    // selected are added, those caught again are removed. Lets the user refine
    // a multi-selection by re-lassoing instead of starting from scratch.
    const hitSet = new Set(annotationIds);
    const kept = selectedItems.filter((i) => !hitSet.has(i.id));
    const added = annotationIds
      .filter((id) => !selectedItems.some((i) => i.id === id))
      .map(buildItem);
    const newItems = [...kept, ...added];
    dispatch(setSelectedItems(newItems));
    dispatch(setAnnotationsToolbarPosition(anchorPosition));
  }

  const { lassoRect, startLasso, updateLasso, endLasso } = useLassoSelection({
    annotations,
    viewportRef,
    toLocalCoords,
    onSelectionComplete: handleLassoSelection
  });

  // Point-level lasso when an annotation is already selected
  const getSelectedAnnotationPoints = useCallback(() => {
    if (!selectedNode?.nodeId) return [];
    const ann = annotations?.find((a) => a.id === selectedNode.nodeId);
    if (!ann) return [];
    return [
      ...(ann.points || []),
      ...(ann.cuts || []).flatMap((c) => c?.points || []),
      ...(ann.innerPoints || []),
      ...(ann.guideLine || []),
    ];
  }, [selectedNode?.nodeId, annotations]);

  const getSelectedAnnotationSegments = useCallback(() => {
    if (!selectedNode?.nodeId) return [];
    const ann = annotations?.find((a) => a.id === selectedNode.nodeId);
    if (!ann) return [];
    return getAnnotationLassoSegments(ann);
  }, [selectedNode?.nodeId, annotations]);

  const handlePointLassoSelection = useCallback(
    (pointIds, partIds) => {
      // Select BOTH the vertices and the segments the lasso catches, toggling
      // each against the current sub-selection (newly caught ones are added,
      // ones caught again are removed). The user then prunes points or segments
      // by shift+clicking / the panel to keep only what they want.
      const nextPointIds = toggleIds(selectedPointIds, pointIds || []);
      const nextPartIds = toggleIds(selectedPartIds, partIds || []);
      dispatch(setSelectedPointIds(nextPointIds));
      dispatch(setSelectedPartIds(nextPartIds));
      // Sync the single sub-selection slot with a representative of each kind so
      // the panels can branch (the combined panel reads the arrays directly).
      const firstPartId = nextPartIds[0] || null;
      const firstPartType = firstPartId
        ? firstPartId.includes("::CUT_SEG::")
          ? "CUT_SEG"
          : "SEG"
        : null;
      dispatch(
        setSubSelection({
          pointId: nextPointIds[0] || null,
          partId: firstPartId,
          partType: firstPartType,
        })
      );
    },
    [dispatch, selectedPointIds, selectedPartIds]
  );

  const {
    lassoRect: pointLassoRect,
    startLasso: startPointLasso,
    updateLasso: updatePointLasso,
    endLasso: endPointLasso,
  } = useLassoPointSelection({
    viewportRef,
    toLocalCoords,
    onSelectionComplete: handlePointLassoSelection,
    getSelectedAnnotationPoints,
    getSelectedAnnotationSegments,
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

  // Image-mode flags (read inside event handlers via refs so we don't
  // re-bind handlers on every redux change).
  const imageModeEnabled = useSelector(
    (s) => s.mapEditor.imageModeEnabled
  );
  const imageModeEnabledRef = useRef(imageModeEnabled);
  useEffect(() => {
    imageModeEnabledRef.current = imageModeEnabled;
  }, [imageModeEnabled]);

  const imageModeLegendSelected = useSelector(
    (s) => s.mapEditor.imageModeLegendSelected
  );
  const imageModeLegendSelectedRef = useRef(imageModeLegendSelected);
  useEffect(() => {
    imageModeLegendSelectedRef.current = imageModeLegendSelected;
  }, [imageModeLegendSelected]);

  const pasteClipboardRef = useRef(pasteClipboard);
  useEffect(() => {
    pasteClipboardRef.current = pasteClipboard;
  }, [pasteClipboard]);

  const pasteTransformRef = useRef(pasteTransform);
  useEffect(() => {
    pasteTransformRef.current = pasteTransform;
  }, [pasteTransform]);

  const pasteDetectionModeRef = useRef(pasteDetectionMode);
  useEffect(() => {
    pasteDetectionModeRef.current = pasteDetectionMode;
  }, [pasteDetectionMode]);

  // Refs mirroring values needed inside the once-bound keydown / mousemove
  // closures (the keydown effect has [] deps).
  const sourceImageElRef = useRef(null);
  const calibrationBaseMapRef = useRef(null);
  const activeLayerIdRef = useRef(activeLayerId);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  const createAnnotationsFromDetectedMatches =
    useCreateAnnotationsFromDetectedMatches();
  const createAnnotationsFromDetectedMatchesRef = useRef(
    createAnnotationsFromDetectedMatches,
  );
  useEffect(() => {
    createAnnotationsFromDetectedMatchesRef.current =
      createAnnotationsFromDetectedMatches;
  }, [createAnnotationsFromDetectedMatches]);

  // Build the reference patch once per clipboard (transform-independent —
  // rotation/flip only affect placed geometry, not the template).
  const computePatternPatch = useCallback(() => {
    const clipboard = pasteClipboardRef.current;
    const sImg = sourceImageElRef.current;
    if (!clipboard || !sImg) return null;
    const cached = patternPatchRef.current;
    if (cached && cached.clipboard === clipboard) return cached.patch;
    const patch = extractAnnotationImagePatch({
      clipboard,
      sourceImageEl: sImg,
      imageScale: baseMapImageScaleRef.current || 1,
      imageOffset: baseMapImageOffsetRef.current || { x: 0, y: 0 },
    });
    patternPatchRef.current = { clipboard, patch };
    return patch;
  }, []);

  // Full source-image ImageData — built lazily & cached so the very first
  // GLOBAL scan (synchronous keypress) doesn't race the warm-up effect.
  const ensureFullImageData = useCallback(() => {
    if (pasteDetectImageDataRef.current) return pasteDetectImageDataRef.current;
    const sImg = sourceImageElRef.current;
    if (!sImg) return null;
    try {
      const w = sImg.naturalWidth || sImg.width;
      const h = sImg.naturalHeight || sImg.height;
      if (!w || !h) return null;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(sImg, 0, 0);
      pasteDetectImageDataRef.current = ctx.getImageData(0, 0, w, h);
      return pasteDetectImageDataRef.current;
    } catch (err) {
      console.error("[patternDetection] failed to build ImageData:", err);
      return null;
    }
  }, []);

  const runPatternDetect = useCallback(async ({ mode, cursorImgPx }) => {
    const clipboard = pasteClipboardRef.current;
    if (!clipboard) return;
    const fullImageData = ensureFullImageData();
    if (!fullImageData) return;
    const patch = computePatternPatch();
    if (!patch?.patternData) return;

    // Search for the motif at the orientation/mirroring the user picked
    // (R / I) — cv.matchTemplate is rigid, so transform the template.
    const patternData = transformImageData(
      patch.patternData,
      pasteTransformRef.current,
    );

    let win = null;
    if (mode === "HOVER") {
      if (!cursorImgPx) return;
      const side =
        (2 * Math.max(patternData.width, patternData.height)) /
        (smartZoomRef.current || 1);
      win = {
        x: cursorImgPx.x - side / 2,
        y: cursorImgPx.y - side / 2,
        width: side,
        height: side,
      };
    }

    let result;
    try {
      result = await runPatternDetection({
        patternData,
        fullImageData,
        window: win,
        clipboard,
        pasteTransform: pasteTransformRef.current,
        imageScale: baseMapImageScaleRef.current || 1,
        imageOffset: baseMapImageOffsetRef.current || { x: 0, y: 0 },
        sourceImgBox: patch.bboxImgPx,
        exclusionMask: patternExclusionMaskRef.current,
        maskWidth: fullImageData.width,
        maskHeight: fullImageData.height,
      });
    } catch (err) {
      console.warn("[patternDetection] failed", err);
      return;
    }

    // Stale guard: clipboard cleared or sub-mode changed while awaiting.
    if (
      pasteClipboardRef.current !== clipboard ||
      pasteDetectionModeRef.current !== mode
    ) {
      return;
    }

    const matches = result?.matches || [];
    detectedPatternMatchesRef.current = matches.length
      ? { matches, clipboard }
      : null;
    transientDetectedPatternRef.current?.updateMatches(matches);
    syncSmartDetectionPresent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computePatternPatch, ensureFullImageData]);

  const runPatternDetectHover = useMemo(
    () =>
      throttle((cursorImgPx) => {
        runPatternDetect({ mode: "HOVER", cursorImgPx });
      }, 250),
    [runPatternDetect],
  );

  const clearPatternDetection = useCallback(() => {
    detectedPatternMatchesRef.current = null;
    patternPatchRef.current = null;
    transientDetectedPatternRef.current?.clear();
    syncSmartDetectionPresent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sourceImageElRef.current = sourceImageEl;
  }, [sourceImageEl]);
  useEffect(() => {
    calibrationBaseMapRef.current = calibrationBaseMap;
  }, [calibrationBaseMap]);

  // Single source of truth for triggering pattern detection: reacts to the
  // sub-mode (keyboard A/S or panel switches) and to rotate/flip
  // (pasteTransform). GLOBAL scans once; HOVER is cleared here and
  // repopulated on mouse move; null/no-clipboard clears.
  useEffect(() => {
    if (
      pasteClipboard?.items?.length === 1 &&
      pasteDetectionMode === "GLOBAL"
    ) {
      runPatternDetect({ mode: "GLOBAL" });
    } else {
      clearPatternDetection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteClipboard, pasteDetectionMode, pasteTransform]);

  const selectedAnnotationForCopyRef = useRef(null);
  const selectedAnnotationsForCopyRef = useRef([]);

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

  const stripDetectionOrientationRef = useRef(stripDetectionOrientation);
  useEffect(() => {
    stripDetectionOrientationRef.current = stripDetectionOrientation;
  }, [stripDetectionOrientation]);
  const stripDetectionMultipleRef = useRef(stripDetectionMultiple);
  useEffect(() => {
    stripDetectionMultipleRef.current = stripDetectionMultiple;
  }, [stripDetectionMultiple]);

  const smartDetectEnabledRef = useRef(smartDetectEnabled);
  useEffect(() => {
    smartDetectEnabledRef.current = smartDetectEnabled;
  }, [smartDetectEnabled]);

  const smartDetectModeRef = useRef(smartDetectMode);
  useEffect(() => {
    smartDetectModeRef.current = smartDetectMode;
  }, [smartDetectMode]);

  const globalDetectionRunningRef = useRef(globalDetectionRunning);
  useEffect(() => {
    globalDetectionRunningRef.current = globalDetectionRunning;
  }, [globalDetectionRunning]);

  // AbortController for the in-flight global-detection mock run. Created on
  // A press, aborted on Escape, cleared after resolve / abort.
  const globalDetectionAbortRef = useRef(null);

  const autoOffsetsOnCommitRef = useRef(autoOffsetsOnCommit);
  useEffect(() => {
    autoOffsetsOnCommitRef.current = autoOffsetsOnCommit;
  }, [autoOffsetsOnCommit]);

  const surfaceDropBarrierMaskRef = useRef(surfaceDropBarrierMask);
  useEffect(() => {
    surfaceDropBarrierMaskRef.current = surfaceDropBarrierMask;
  }, [surfaceDropBarrierMask]);

  // Tracks the last SURFACE_DROP flood-fill result (image-pixel coords) so
  // the click handler can commit it without re-running the detection.
  const surfaceDropPreviewImgPxRef = useRef(null);
  // rAF throttle for the mousemove flood-fill to cap at ~60 fps even on
  // very fast cursor moves.
  const surfaceDropRafRef = useRef(0);
  const surfaceDropLastCursorRef = useRef(null);

  // Drop any pending flood-fill preview when the user switches tool or
  // turns smartDetect off — avoids stale polygons flashing on the map.
  useEffect(() => {
    const active = smartDetectEnabled && enabledDrawingMode === "SURFACE_DROP";
    if (!active) {
      if (surfaceDropRafRef.current) {
        cancelAnimationFrame(surfaceDropRafRef.current);
        surfaceDropRafRef.current = 0;
      }
      surfaceDropPreviewImgPxRef.current = null;
      surfaceDropLastCursorRef.current = null;
      dispatch(setSurfaceDropPreview(null));
    }
  }, [smartDetectEnabled, enabledDrawingMode, dispatch]);

  const onCommitDrawingRef = useRef(onCommitDrawing);
  useEffect(() => {
    onCommitDrawingRef.current = onCommitDrawing;
  }, [onCommitDrawing]);

  const onCommitGuideLineRef = useRef(onCommitGuideLine);
  useEffect(() => {
    onCommitGuideLineRef.current = onCommitGuideLine;
  }, [onCommitGuideLine]);

  const onCommitSimilarStripsRef = useRef(onCommitSimilarStrips);
  useEffect(() => {
    onCommitSimilarStripsRef.current = onCommitSimilarStrips;
  }, [onCommitSimilarStrips]);

  const onCommitDetectedFeaturesRef = useRef(onCommitDetectedFeatures);
  useEffect(() => {
    onCommitDetectedFeaturesRef.current = onCommitDetectedFeatures;
  }, [onCommitDetectedFeatures]);

  const onCommitPointsFromSurfaceDropRef = useRef(onCommitPointsFromSurfaceDrop);
  useEffect(() => {
    onCommitPointsFromSurfaceDropRef.current = onCommitPointsFromSurfaceDrop;
  }, [onCommitPointsFromSurfaceDrop]);

  const rawDetectionRef = useRef(rawDetection);
  useEffect(() => { rawDetectionRef.current = rawDetection; }, [rawDetection]);
  const convexHullEnabledRef = useRef(convexHullEnabled);
  useEffect(() => { convexHullEnabledRef.current = convexHullEnabled; }, [convexHullEnabled]);

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

  // ADD_GUIDE_LINE: self-contained multi-click capture (reuses the generic
  // drawingPoints/DrawingLayer preview in local pixel space). Enter commits
  // the polyline to the selected annotation's guideLine, Escape cancels.
  useEffect(() => {
    if (enabledDrawingMode !== "ADD_GUIDE_LINE") return;
    const clear = () => {
      setDrawingPoints([]);
      drawingPointsRef.current = [];
      drawingLayerRef.current?.setPoints?.([]);
    };
    const onKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const pts = drawingPointsRef.current || [];
        if (pts.length >= 2) onCommitGuideLineRef.current?.(pts);
        clear();
        dispatch(setEnabledDrawingMode(null));
      } else if (e.key === "Escape") {
        e.preventDefault();
        clear();
        dispatch(setEnabledDrawingMode(null));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabledDrawingMode, dispatch, setDrawingPoints, drawingPointsRef]);

  // Track whether the first rectangle corner has been placed (for the
  // RectangleDimsBottomBar to switch between its prompt and its dimensions UI).
  // Placed here (after useDrawingCommit) so `drawingPoints` is in scope for the
  // dependency array — referencing it earlier would hit the const TDZ.
  useEffect(() => {
    const isRect = [
      "RECTANGLE",
      "POLYLINE_RECTANGLE",
      "POLYGON_RECTANGLE",
      "CUT_RECTANGLE",
    ].includes(enabledDrawingMode);
    setRectHasFirstPoint(isRect && drawingPoints.length === 1);
  }, [enabledDrawingMode, drawingPoints.length, setRectHasFirstPoint]);

  const saveTempAnnotations = useSaveTempAnnotations();

  // COMPLETE_ANNOTATION state
  const completeAnnotationRef = useRef(null); // { id, type } of the annotation being extended
  const completeStartPointRef = useRef(null); // starting vertex point ID

  const stateRef = useRef({
    selectedNode,
    selectedPointId,
    selectedPartId,
    selectedPointIds,
    enabledDrawingMode: enabledDrawingMode, // Si besoin dans le listener
    onDeletePoint,
    onDeletePoints,
    onHideSegment,
    onRemoveCut,
    onDeleteGuideLine,
    permissions,
  });
  useEffect(() => {
    stateRef.current = {
      selectedNode,
      selectedPointId,
      selectedPartId,
      selectedPointIds,
      onDeletePoint,
      onDeletePoints,
      onHideSegment,
      onRemoveCut,
      onDeleteGuideLine,
      enabledDrawingMode,
      permissions,
    };
  }, [selectedNode?.nodeId, selectedPointId, selectedPartId, selectedPointIds, onDeletePoint, onDeletePoints, onHideSegment, onRemoveCut, onDeleteGuideLine, enabledDrawingMode, permissions]);


  // 1. Calculer le style curseur du conteneur
  const getCursorStyle = () => {
    if (dragState?.active) return 'crosshair';
    if (POINTER_CLICK_MODES.includes(enabledDrawingMode)) return 'pointer';
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
      const { selectedNode, selectedPointId, selectedPartId, selectedPointIds, onDeletePoint, onDeletePoints, onHideSegment, onRemoveCut, permissions } = stateRef.current;
      const showSmartDetect = showSmartDetectRef.current;
      const enabledDrawingMode = enabledDrawingModeRef.current;

      if (e.repeat) return;

      // Shift outside drawing starts a selection (lasso / shift+click). Hide
      // any visible snap helper so it can't intercept the next click.
      if (e.key === "Shift" && !enabledDrawingMode) {
        snappingLayerRef.current?.update(null);
      }

      // --- Copy/paste: Ctrl/Cmd+C captures the selected annotation as a
      // paste-clipboard snapshot. Only fires on the active viewer.
      if (
        isActiveViewerRef.current &&
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "C")
      ) {
        const anns = selectedAnnotationsForCopyRef.current || [];
        if (!anns.length) return;
        const supportedAnns = anns.filter((a) =>
          PASTE_SUPPORTED_TYPES.includes(a?.type),
        );
        if (!supportedAnns.length) {
          dispatch(setToaster({
            message: `Copy/paste not yet supported for "${anns[0]?.type}"`,
            severity: "info",
          }));
          return;
        }
        e.preventDefault();

        const items = supportedAnns.map(buildClipboardItem).filter(Boolean);
        if (!items.length) return;

        // Group center = center of the union bbox of every item's px points.
        // A single shared center is what lets the whole group translate by one
        // (targetCenter − groupCenter) and rotate/flip rigidly on paste.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const acc = (p) => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        };
        for (const it of items) {
          if (it.basePoints) it.basePoints.forEach(acc);
          if (it.baseCuts) it.baseCuts.forEach((c) => c.points.forEach(acc));
          if (it.basePoint) acc(it.basePoint);
        }
        const sourceCenter = Number.isFinite(minX)
          ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
          : { x: 0, y: 0 };

        dispatch(setPasteClipboard({ sourceCenter, items }));
        // The clipboard now holds a full snapshot — drop the live selection
        // so the copied annotations are no longer selected (mirrors Escape).
        dispatch(clearSelection());
        dispatch(setSelectedEntityId(null));
        return;
      }

      // --- Paste mode: I = flip, R = rotate 90°. Only fires when a
      // paste-clipboard is active and the viewer is the active one.
      if (
        isActiveViewerRef.current &&
        pasteClipboardRef.current &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          dispatch(flipPasteClipboardX());
          return;
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          dispatch(rotatePasteClipboard());
          return;
        }
        // A / S — toggle the pattern detection sub-mode. The actual
        // detection run is centralized in a paste-detection effect so the
        // panel switches and the keyboard stay in sync. Pattern detection is
        // single-template only: ignore when multiple annotations are copied.
        const singleTemplate =
          pasteClipboardRef.current?.items?.length === 1;
        if (singleTemplate && (e.key === "a" || e.key === "A")) {
          e.preventDefault();
          dispatch(
            setPasteDetectionMode(
              pasteDetectionModeRef.current === "GLOBAL" ? null : "GLOBAL",
            ),
          );
          return;
        }
        if (singleTemplate && (e.key === "s" || e.key === "S")) {
          e.preventDefault();
          dispatch(
            setPasteDetectionMode(
              pasteDetectionModeRef.current === "HOVER" ? null : "HOVER",
            ),
          );
          return;
        }
      }

      // --- Rectangle typed X/Y dimensions (after first corner placed) ---
      // Window-scoped listener — only the active viewer should react,
      // otherwise duplicate viewers (e.g. main + BASE_MAPS) double-capture each key.
      const isRectangleSecondPhase =
        isActiveViewerRef.current &&
        ["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode) &&
        drawingPointsRef.current?.length === 1;

      if (isRectangleSecondPhase && e.key !== "Escape") {
        // Axis switching (also resets the targeted buffer)
        if (e.key === "x" || e.key === "X") {
          e.preventDefault();
          setRectAxis("x");
          return;
        }
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          setRectAxis("y");
          return;
        }
        // The remaining keys only act when an axis is currently selected
        if (rectCurrentAxisRef.current) {
          // Sign toggle
          if (e.key === "-") {
            e.preventDefault();
            toggleRectBufferSign();
            return;
          }
          // Digit / dot / comma → append to current axis buffer
          if (/^[0-9.,]$/.test(e.key)) {
            e.preventDefault();
            appendToRectBuffer(e.key === "," ? "." : e.key);
            return;
          }
          // Backspace → erase last char of current axis buffer
          if (e.key === "Backspace") {
            e.preventDefault();
            deleteFromRectBuffer();
            return;
          }
          // Space → silent separator
          if (e.key === " ") {
            e.preventDefault();
            return;
          }
        }
        // Enter → commit with typed dims (missing axis falls back to mouse)
        if (e.key === "Enter") {
          const metrics = rectMetricsRef.current || {};
          if (metrics.rectX != null || metrics.rectY != null) {
            e.preventDefault();
            const lastPoint = drawingPointsRef.current[0];
            const mbp = meterByPxRef.current;
            const hasScale = Number.isFinite(mbp) && mbp > 0;
            const mPerPx = hasScale ? mbp : 1;
            const fallbackPos = lastPreviewPosRef.current || lastPoint;
            const angleDeg = orthoSnapAngleOffsetRef.current || 0;
            let finalPos;
            if (angleDeg === 0) {
              finalPos = {
                x: metrics.rectX != null ? lastPoint.x + metrics.rectX / mPerPx : fallbackPos.x,
                y: metrics.rectY != null ? lastPoint.y + metrics.rectY / mPerPx : fallbackPos.y,
              };
            } else {
              const theta = (-angleDeg * Math.PI) / 180;
              const cos = Math.cos(theta);
              const sin = Math.sin(theta);
              const fdx = fallbackPos.x - lastPoint.x;
              const fdy = fallbackPos.y - lastPoint.y;
              const projX = fdx * cos + fdy * sin;
              const projY = -fdx * sin + fdy * cos;
              const dx_local = metrics.rectX != null ? metrics.rectX / mPerPx : projX;
              const dy_local = metrics.rectY != null ? metrics.rectY / mPerPx : projY;
              finalPos = {
                x: lastPoint.x + dx_local * cos - dy_local * sin,
                y: lastPoint.y + dx_local * sin + dy_local * cos,
              };
            }
            const nextPoints = [lastPoint, finalPos];
            setDrawingPoints(nextPoints);
            drawingPointsRef.current = nextPoints;
            commitPolyline();
            clearRectBuffers();
            return;
          }
        }
      }

      switch (e.key) {
        // 1. ESCAPE : Reset Selection
        case 'Escape':
          console.log("Action: Reset Selection & Tool");

          // Paste mode trumps everything: just exit cleanly without resetting
          // unrelated drawing/selection state.
          if (pasteClipboardRef.current) {
            dispatch(clearPasteClipboard());
            pastePreviewLayerRef.current?.clearPreview();
            pasteDetectionModeRef.current = null;
            pasteDetectImageDataRef.current = null;
            clearPatternDetection();
            e.stopPropagation();
            return;
          }

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

          // Abort an in-flight GLOBAL smart-detect run (spinner phase) without
          // clearing the rest of the drawing state.
          if (globalDetectionAbortRef.current) {
            globalDetectionAbortRef.current.abort();
            globalDetectionAbortRef.current = null;
            screenCursorRef.current?.hideSpinner();
            dispatch(setGlobalDetectionRunning(false));
            e.stopPropagation();
            return;
          }

          // Dismiss a pending GLOBAL feature set (post-run, awaiting Space)
          // without leaving the drawing tool.
          if (detectedGlobalFeaturesRef.current) {
            detectedGlobalFeaturesRef.current = null;
            transientDetectedStripsRef.current?.clear();
            syncSmartDetectionPresent();
            e.stopPropagation();
            return;
          }

          // Mid-drawing: if points have already been placed, reset just the
          // in-progress points and stay in the current drawing mode so the
          // user can restart the click cycle without re-picking the tool.
          if (enabledDrawingMode && drawingPointsRef.current?.length > 0) {
            setDrawingPoints([]);
            drawingPointsRef.current = [];
            clearRectBuffers();
            e.stopPropagation();
            return;
          }

          // Reset split polyline state if active
          onSplitPolylineResetRef.current?.();

          // setSelectedPointId(null); // Removed
          resetNewAnnotation();
          clearRectBuffers();
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
          completeAnnotationRef.current = null;
          completeStartPointRef.current = null;

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
          // Clear detected similar strips + global features (share the
          // same transient layer for the green flash preview).
          detectedSimilarStripsRef.current = null;
          detectedGlobalFeaturesRef.current = null;
          transientDetectedStripsRef.current?.clear();
          cachedDetectImageUrlRef.current = null;
          transientDetectedPolygonRef.current?.clear();
          detectedShapeRef.current = null;
          syncSmartDetectionPresent();
          break;

        case 'd':

          const mousePos = lastMouseScreenPosRef.current;
          setShowSmartDetect(true);
          updateSmartDetect(mousePos);
          break;

        case 'o':
        case 'O':
          if (enabledDrawingModeRef.current === "POLYGON_CLICK") {
            e.preventDefault();
            dispatch(setAutoOffsetsOnCommit(!autoOffsetsOnCommitRef.current));
          }
          break;

        case ' ':
          // --- SURFACE_DROP smartDetect: commit the current flood-fill preview ---
          if (
            smartDetectEnabledRef.current &&
            enabledDrawingModeRef.current === "SURFACE_DROP" &&
            surfaceDropPreviewImgPxRef.current &&
            surfaceDropPreviewImgPxRef.current.length >= 3
          ) {
            e.preventDefault();
            const imgPxPoints = surfaceDropPreviewImgPxRef.current;
            const scale = baseMapImageScaleRef.current || 1;
            const offset = baseMapImageOffsetRef.current || { x: 0, y: 0 };
            const rawLocalPoints = imgPxPoints.map((p) => ({
              x: p.x * scale + offset.x,
              y: p.y * scale + offset.y,
            }));

            let localPoints;
            if (rawDetectionRef.current) {
              localPoints = rawLocalPoints;
            } else {
              ({ points: localPoints } = alignPolygonsToGrid(
                rawLocalPoints,
                undefined,
                {
                  referenceAngle: orthoSnapAngleOffsetRef.current || null,
                  meterByPx: meterByPxRef.current || 0,
                }
              ));
            }

            const CONVEX_HULL_THRESHOLD = 42;
            let finalPoints = localPoints;
            if (convexHullEnabledRef.current && localPoints.length > CONVEX_HULL_THRESHOLD) {
              finalPoints = convexHull(localPoints);
            }

            const topMiddlePoint = getTopMiddlePoint(finalPoints);
            const pose = getTargetPose();
            const worldX = topMiddlePoint.x * pose.k + pose.x;
            const worldY = topMiddlePoint.y * pose.k + pose.y;
            const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);
            onCommitPointsFromSurfaceDropRef.current?.({
              points: finalPoints,
              cuts: undefined,
              screenPos,
            });

            surfaceDropPreviewImgPxRef.current = null;
            dispatch(setSurfaceDropPreview(null));
            return;
          }

          // --- Copy/paste pattern detection: bulk-create at all matches ---
          if (detectedPatternMatchesRef.current?.matches?.length) {
            e.preventDefault();
            const { matches, clipboard } = detectedPatternMatchesRef.current;
            createAnnotationsFromDetectedMatchesRef
              .current?.({
                matches,
                clipboard,
                pasteTransform: pasteTransformRef.current,
                baseMap: calibrationBaseMapRef.current,
                activeLayerId: activeLayerIdRef.current,
              })
              .catch((err) => {
                console.warn("[patternDetection] bulk create failed", err);
                dispatch(
                  setToaster({
                    message: "Bulk paste failed — see console for details.",
                    severity: "error",
                  }),
                );
              });
            detectedPatternMatchesRef.current = null;
            transientDetectedPatternRef.current?.clear();
            syncSmartDetectionPresent();
            return;
          }

          // --- DETECT_SIMILAR_STRIPS: commit all detected strips ---
          if (detectedSimilarStripsRef.current) {
            e.preventDefault();
            const { strips, sourceAnnotation } = detectedSimilarStripsRef.current;
            if (strips?.length > 0 && onCommitSimilarStripsRef.current) {
              console.log("[DETECT_SIMILAR_STRIPS] Committing", strips.length, "strips");
              onCommitSimilarStripsRef.current({ strips, sourceAnnotation });
            }
            detectedSimilarStripsRef.current = null;
            syncSmartDetectionPresent();
            transientDetectedStripsRef.current?.clear();
            return;
          }

          // --- GLOBAL FLOOR-PLAN DETECTION: commit all detected features ---
          if (detectedGlobalFeaturesRef.current) {
            e.preventDefault();
            const { features, sourceAnnotation } = detectedGlobalFeaturesRef.current;
            if (features?.length > 0 && onCommitDetectedFeaturesRef.current) {
              console.log(
                "[GLOBAL_DETECTION] Committing",
                features.length,
                "features",
              );
              onCommitDetectedFeaturesRef.current({ features, sourceAnnotation });
            }
            detectedGlobalFeaturesRef.current = null;
            syncSmartDetectionPresent();
            transientDetectedStripsRef.current?.clear();
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
              syncSmartDetectionPresent();
              transientDetectedPolygonRef.current?.clear();
            }
            return;
          }

          // --- RECTANGLE (and other loupe shape detection): commit current shape ---
          if (detectedShapeRef.current) {
            e.preventDefault();
            const shape = detectedShapeRef.current;
            if (shape?.points?.length >= 2 && onCommitDrawingRef.current) {
              const closeLine = shape.type === "RECTANGLE";
              onCommitDrawingRef.current({
                points: shape.points,
                options: closeLine ? { closeLine: true } : undefined,
              });
              setDrawingPoints([]);
              drawingPointsRef.current = [];
              drawingLayerRef.current?.setPoints?.([]);
            }
            detectedShapeRef.current = null;
            syncSmartDetectionPresent();
            transientDetectedShapeLayerRef.current?.updateShape(null);
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

        case "a":
          // GLOBAL smart-detect: runs the OpenCV wall + pillar detector
          // (see runGlobalFloorPlanDetection) over the whole baseMap image
          // with the existing-annotations exclusion mask applied. Spinner
          // shows on the cursor during the worker run, results flash green
          // via transientDetectedStripsRef, Space commits them all as new
          // POLYLINE annotations, Escape aborts.
          // Not applicable to surface drawing: POLYGON_CLICK only uses hover
          // polygon detection (detectPolygonFromAnnotations), not line detection.
          if (enabledDrawingModeRef.current === "POLYGON_CLICK") break;
          if (showSmartDetectRef.current && !globalDetectionRunningRef.current) {
            e.preventDefault();
            const meterByPx = meterByPxRef.current ?? 0;
            const imageScale = baseMapImageScaleRef.current || 1;
            const imageOffset = baseMapImageOffsetRef.current || { x: 0, y: 0 };
            const baseMap = calibrationBaseMapRef.current;
            const na = newAnnotationRef.current;
            if (!baseMap || !(meterByPx > 0) || !na) {
              console.warn(
                "[smartDetect] global run skipped — missing baseMap / scale / annotation template",
              );
              break;
            }
            dispatch(setSmartDetectMode("GLOBAL"));
            dispatch(setGlobalDetectionRunning(true));
            screenCursorRef.current?.showSpinner();
            const controller = new AbortController();
            globalDetectionAbortRef.current = controller;
            runGlobalFloorPlanDetection({
              signal: controller.signal,
              baseMap,
              annotations: annotationsRef.current || [],
              newAnnotation: na,
              imageScale,
              imageOffset,
              meterByPx,
            })
              .then(({ features }) => {
                if (controller.signal.aborted) return;
                screenCursorRef.current?.hideSpinner();
                globalDetectionAbortRef.current = null;
                dispatch(setGlobalDetectionRunning(false));
                if (!features?.length) {
                  console.log("[smartDetect] global run: no features detected");
                  detectedGlobalFeaturesRef.current = null;
                  transientDetectedStripsRef.current?.clear();
                  syncSmartDetectionPresent();
                  return;
                }
                detectedGlobalFeaturesRef.current = {
                  features,
                  sourceAnnotation: na,
                };
                transientDetectedStripsRef.current?.updateStrips(
                  features.map((f) => ({ polygon: f.polygon })),
                );
                syncSmartDetectionPresent();
              })
              .catch((err) => {
                if (err?.name === "AbortError") return;
                console.warn("[smartDetect] global run failed", err);
                screenCursorRef.current?.hideSpinner();
                globalDetectionAbortRef.current = null;
                dispatch(setGlobalDetectionRunning(false));
              });
          }
          break;

        case "f":
          if (showSmartDetect && smartDetectEnabledRef.current) {
            dispatch(cycleLoupeAspect());
            // Ref/visual refresh is handled by the loupeAspectRedux sync effect.
          }
          break;

        case "p":
          // "Augmenter la taille" — larger sampled ROI → lower magnification.
          if (showSmartDetect) {
            smartZoomRef.current = smartZoomRef.current * 0.9;
            refreshSmartDetectZoom();
          }
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
          // "Diminuer la taille" — smaller sampled ROI → higher magnification.
          if (showSmartDetect) {
            smartZoomRef.current = smartZoomRef.current * 1.1;
            refreshSmartDetectZoom();
          }
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
            break;
          }
          // HOVER smart-detect (formerly bound to A): toggle the loupe-based
          // detection that runs as the cursor moves.
          if (showSmartDetectRef.current) {
            dispatch(setSmartDetectMode("HOVER"));
            dispatch(toggleSmartDetectEnabled());
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
          if (["CLICK", "POLYLINE_CLICK", "POLYGON_CLICK", "CUT_CLICK", "SPLIT_CLICK", "STRIP", "BRUSH", "COMPLETE_ANNOTATION"].includes(enabledDrawingModeRef.current)) {
            if (enabledDrawingModeRef.current === "COMPLETE_ANNOTATION" && completeAnnotationRef.current) {
              commitPolyline(null, {
                completeAnnotationId: completeAnnotationRef.current.id,
                startPointId: completeStartPointRef.current,
                endPointId: null,
              });
              completeAnnotationRef.current = null;
              completeStartPointRef.current = null;
            } else {
              commitPolyline();
            }
          }

          if (enabledDrawingModeRef.current === "SMART_DETECT") {
            const localPoints = smartDetectRef.current?.getDetectedPoints();
            const roiData = lastSmartROI.current; // On récupère ce qu'on a stocké

            if (localPoints && roiData) {
              const { width: lw, height: lh } = getLoupeScreenSize();
              const ratioX = roiData.width / lw;
              const ratioY = roiData.height / lh;
              const finalPoints = localPoints.map(p => ({
                x: roiData.x + (p.x * ratioX),
                y: roiData.y + (p.y * ratioY)
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
          // Only the active viewer should react — this listener is window-scoped
          // and InteractionLayer stays mounted while other viewers (e.g. THREED)
          // are visible (PanelShowable just translates panels off-screen).
          if (!isActiveViewerRef.current) break;
          // When drawing with a constraint buffer, Backspace erases from buffer
          if (enabledDrawingMode && e.key === 'Backspace') {
            deleteFromBuffer();
            break;
          }
          console.log("Action: Delete Selected");
          // 1a. Multi-point selection: bulk delete (no confirmation dialog)
          if (selectedPointIds?.length > 0 && selectedNode?.nodeId && onDeletePoints) {
            if (!permissions.canEditAnnotation(selectedNode?.nodeId)) break;
            console.log("Action: Delete Points (bulk)", selectedPointIds, selectedNode?.nodeId);
            onDeletePoints({ pointIds: [...selectedPointIds], annotationId: selectedNode?.nodeId });
            dispatch(clearSelectedPointIds());
            dispatch(setSubSelection({ pointId: null }));
            e.stopPropagation();
            return;
          }
          // 1b. Single point selection (legacy)
          if (selectedPointId && onDeletePoint) {
            // PERMISSION GUARD : bloquer si pas propriétaire de l'annotation
            if (!permissions.canEditAnnotation(selectedNode?.nodeId)) break;
            console.log("Action: Delete Point", selectedPointId, selectedNode?.nodeId);
            onDeletePoint({ pointId: selectedPointId, annotationId: selectedNode?.nodeId });
            dispatch(setSubSelection({ pointId: null }));
            e.stopPropagation();
            return;
          }
          else if (selectedPartId && selectedNode?.nodeId) {
            // PERMISSION GUARD : bloquer si pas propriétaire de l'annotation
            if (!permissions.canEditAnnotation(selectedNode?.nodeId)) break;
            const parts = selectedPartId.split('::'); // annotationId::TYPE::index[::subIndex]
            const type = parts[1];
            const index = parseInt(parts[2], 10);

            // A. Suppression de SEGMENT du contour principal (Cacher)
            if (type === 'SEG' && onHideSegment) {
              onHideSegment({
                annotationId: selectedNode.nodeId,
                segmentIndex: index
              });
              dispatch(setSubSelection({ partId: null }));
              e.stopPropagation();
              return;
            }

            // B. Suppression de SEGMENT d'un cut (Cacher)
            if (type === 'CUT_SEG' && onHideSegment) {
              const cutIndex = index;
              const segmentIndex = parseInt(parts[3], 10);
              onHideSegment({
                annotationId: selectedNode.nodeId,
                cutIndex,
                segmentIndex
              });
              dispatch(setSubSelection({ partId: null }));
              e.stopPropagation();
              return;
            }

            // C. Suppression de CUT (Trou)
            if (type === 'CUT' && onRemoveCut) {
              onRemoveCut({
                annotationId: selectedNode.nodeId,
                cutIndex: index
              });
              dispatch(setSubSelection({ partId: null }));
              e.stopPropagation();
              return;
            }

            // D. Suppression de la guideLine
            const { onDeleteGuideLine } = stateRef.current;
            if (type === 'GUIDE_LINE' && onDeleteGuideLine) {
              onDeleteGuideLine({ annotationId: selectedNode.nodeId });
              dispatch(setSubSelection({ partId: null, partType: null }));
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
          // Digit / dot / comma → append to constraint buffer while drawing
          if (enabledDrawingMode && /^[0-9.,]$/.test(e.key)) {
            const char = e.key === "," ? "." : e.key;
            appendToBuffer(char);
          }
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

    // CAPTURE / image mode: all annotation interactions are disabled.
    // Pan/zoom remain available because they live in MapEditorViewport.
    if (imageModeEnabledRef.current) return;

    // --- Paste mode: a click places a copy at the cursor and keeps the
    // mode active so multiple copies can be placed. Esc exits.
    if (pasteClipboardRef.current) {
      const targetCenter = toLocalCoords(worldPos);
      // Fire-and-forget so the click feels instant; service writes points +
      // annotation + mapping rows in a single Dexie transaction, then
      // dispatches one liveQuery refresh.
      pasteAnnotationService({
        pasteClipboard: pasteClipboardRef.current,
        pasteTransform: pasteTransformRef.current,
        targetCenter,
        baseMap: calibrationBaseMap,
        activeLayerId,
        dispatch,
        triggerAnnotationsUpdate,
      }).catch((err) => {
        console.warn("[paste] failed", err);
        dispatch(setToaster({
          message: "Paste failed — see console for details.",
          severity: "error",
        }));
      });
      return;
    }

    // Cross-tab navigation: in pure SELECT mode (no drawing tool, no anchor
    // pick), forward the click world position to the parent so it can
    // broadcast a 3D-camera pan event to other tabs.
    if (!enabledDrawingMode && !anchorSourceAnnotationId) {
      onMapClickInSelectMode?.({ worldPos, event });
    }

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

    // --- REASSIGN_TEMPLATE: click on an annotation to replace its template
    // with the currently selected ANNOTATION_TEMPLATE (sticky cursor).
    if (enabledDrawingMode === "REASSIGN_TEMPLATE") {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hit = nativeTarget.closest?.('[data-node-type="ANNOTATION"]');
      if (hit) {
        const annotation = annotations?.find((a) => a.id === hit.dataset?.nodeId);
        const editTarget = selectedItems[0];
        if (
          editTarget?.type === "ANNOTATION_TEMPLATE" &&
          editTarget.id &&
          annotation &&
          annotation.annotationTemplateId !== editTarget.id
        ) {
          await updateAnnotationService({
            id: annotation.id,
            annotationTemplateId: editTarget.id,
          });
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

    // --- ADD_GUIDE_LINE: accumulate a polyline on the selected annotation ---
    // Each click appends a point (local pixel space); DrawingLayer renders
    // the in-progress polyline. Enter/Escape (keydown effect) finishes.
    if (enabledDrawingMode === "ADD_GUIDE_LINE") {
      const local = toLocalCoords(worldPos);
      const next = [...(drawingPointsRef.current || []), local];
      setDrawingPoints(next);
      drawingPointsRef.current = next;
      drawingLayerRef.current?.setPoints?.(next);
      return;
    }

    // --- ADD_INNER_POINT: drop a Steiner point inside a polygon ---
    // Silent reject if the click is outside any polygon's filled area or
    // inside one of its cuts.
    if (enabledDrawingMode === "ADD_INNER_POINT") {
      const local = toLocalCoords(worldPos);
      const polygon = findPolygonContaining(local, annotations);
      if (polygon) {
        await createInnerPointService({
          annotation: polygon,
          localPos: local,
          baseMap: calibrationBaseMap,
        });
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

    if (["CLICK", "POLYLINE_CLICK", "POLYGON_CLICK", "CUT_CLICK", "SPLIT_CLICK", "STRIP", "COMPLETE_ANNOTATION"].includes(enabledDrawingMode)) {
      // --- ORTHO_PATHS intercept: run BFS tracing instead of adding a point ---
      // (not for POLYGON_CLICK — polygon detection uses annotation geometry, not ORTHO_PATHS)
      const currentDetectMode = smartDetectRef.current?.getSelectedDetectMode?.();
      if (currentDetectMode === "ORTHO_PATHS" && showSmartDetectRef.current && enabledDrawingMode !== "POLYGON_CLICK" && advancedLayout) {
        let localPos = toLocalCoords(worldPos);

        // Apply shift-snap (ortho/45°) before adding the point
        if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPointsRef.current.length > 0) {
          const lastPoint = drawingPointsRef.current[drawingPointsRef.current.length - 1];
          const offset = orthoSnapAngleOffsetRef.current;
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
        const offset = orthoSnapAngleOffsetRef.current;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }
      // Apply fixed length constraint
      if (fixedLengthRef.current && drawingPoints.length > 0) {
        const mbp = meterByPxRef.current;
        const hasScale = Number.isFinite(mbp) && mbp > 0;
        finalPos = applyFixedLengthConstraint({
          lastPointPx: drawingPoints[drawingPoints.length - 1],
          candidatePointPx: finalPos,
          fixedLengthMeters: fixedLengthRef.current,
          meterPerPixel: hasScale ? mbp : 1,
        });
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
        const offset = orthoSnapAngleOffsetRef.current;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }
      // Apply fixed length constraint
      if (fixedLengthRef.current && drawingPoints.length > 0) {
        const mbp = meterByPxRef.current;
        const hasScale = Number.isFinite(mbp) && mbp > 0;
        finalPos = applyFixedLengthConstraint({
          lastPointPx: drawingPoints[drawingPoints.length - 1],
          candidatePointPx: finalPos,
          fixedLengthMeters: fixedLengthRef.current,
          meterPerPixel: hasScale ? mbp : 1,
        });
      }

      // 1. Ajouter le point (Déclenche un re-render de DrawingLayer pour la partie statique)
      setDrawingPoints(prev => [...prev, finalPos]);
      drawingPointsRef.current = [finalPos];
      commitPoint();
    }

    // --- CASE 3: MEASURE / SEGMENT (Auto-commit after 2 points) ---
    else if (["MEASURE", "SEGMENT", "RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "COTE_TWO_CLICK"].includes(enabledDrawingMode)) {
      let finalPos = toLocalCoords(worldPos);

      // Apply Angle Snap (Ortho) if Shift is held or ortho snap is enabled
      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const offset = orthoSnapAngleOffsetRef.current;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }
      // Apply fixed length constraint
      if (fixedLengthRef.current && drawingPoints.length > 0) {
        const mbp = meterByPxRef.current;
        const hasScale = Number.isFinite(mbp) && mbp > 0;
        finalPos = applyFixedLengthConstraint({
          lastPointPx: drawingPoints[drawingPoints.length - 1],
          candidatePointPx: finalPos,
          fixedLengthMeters: fixedLengthRef.current,
          meterPerPixel: hasScale ? mbp : 1,
        });
      }

      // Apply rectangle X/Y typed-dimensions override for the second point
      const isRectangleMode = ["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode);
      if (isRectangleMode && drawingPoints.length === 1) {
        const metrics = rectMetricsRef.current || {};
        if (metrics.rectX != null || metrics.rectY != null) {
          const lastPoint = drawingPoints[0];
          const mbp = meterByPxRef.current;
          const hasScale = Number.isFinite(mbp) && mbp > 0;
          const mPerPx = hasScale ? mbp : 1;
          const angleDeg = orthoSnapAngleOffsetRef.current || 0;
          if (angleDeg === 0) {
            if (metrics.rectX != null) finalPos = { ...finalPos, x: lastPoint.x + metrics.rectX / mPerPx };
            if (metrics.rectY != null) finalPos = { ...finalPos, y: lastPoint.y + metrics.rectY / mPerPx };
          } else {
            const theta = (-angleDeg * Math.PI) / 180;
            const cos = Math.cos(theta);
            const sin = Math.sin(theta);
            const fdx = finalPos.x - lastPoint.x;
            const fdy = finalPos.y - lastPoint.y;
            const projX = fdx * cos + fdy * sin;
            const projY = -fdx * sin + fdy * cos;
            const dx_local = metrics.rectX != null ? metrics.rectX / mPerPx : projX;
            const dy_local = metrics.rectY != null ? metrics.rectY / mPerPx : projY;
            finalPos = {
              x: lastPoint.x + dx_local * cos - dy_local * sin,
              y: lastPoint.y + dx_local * sin + dy_local * cos,
            };
          }
        }
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
        if (isRectangleMode) clearRectBuffers();
      }


    }

    // --- CASE 3b: CIRCLE / ARC (Auto-commit after 3 points) ---
    else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE", "ARC", "POLYLINE_ARC"].includes(enabledDrawingMode)) {
      let finalPos = toLocalCoords(worldPos);

      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const offset = orthoSnapAngleOffsetRef.current;
        finalPos = snapToAngle(finalPos, lastPoint, offset);
      }
      // Apply fixed length constraint
      if (fixedLengthRef.current && drawingPoints.length > 0) {
        const mbp = meterByPxRef.current;
        const hasScale = Number.isFinite(mbp) && mbp > 0;
        finalPos = applyFixedLengthConstraint({
          lastPointPx: drawingPoints[drawingPoints.length - 1],
          candidatePointPx: finalPos,
          fixedLengthMeters: fixedLengthRef.current,
          meterPerPixel: hasScale ? mbp : 1,
        });
      }

      const nextPoints = [...drawingPoints, finalPos];
      setDrawingPoints(nextPoints);

      if (nextPoints.length === 3) {
        drawingPointsRef.current = nextPoints;
        commitPolyline(event);
      }
    }

    // -- CASE 4: SURFACE_DROP
    //    • smartDetect ON → commit the current loupe-flood-fill preview
    //      (pure-JS, built on mousemove from surfaceDropBarrierMaskRef).
    //    • smartDetect OFF → legacy OpenCV contour detection over the
    //      whole viewport.
    else if (enabledDrawingMode === "SURFACE_DROP" && smartDetectEnabled) {
      let rawImgPxPoints = surfaceDropPreviewImgPxRef.current;

      // Preview might be absent (cursor hadn't moved since tool activation
      // or mask not ready) — run one synchronous flood-fill at the click.
      if (!rawImgPxPoints || rawImgPxPoints.length < 3) {
        const barrier = surfaceDropBarrierMaskRef.current;
        const loupeBBox = lastSmartROI.current;
        if (barrier && loupeBBox) {
          const localPosSeed = toLocalCoords(worldPos);
          const seed = {
            x: (localPosSeed.x - baseMapImageOffset.x) / baseMapImageScale,
            y: (localPosSeed.y - baseMapImageOffset.y) / baseMapImageScale,
          };
          const orthoAngleRad =
            (-(orthoSnapAngleOffsetRef.current || 0) * Math.PI) / 180;
          const fill = floodFillFromLoupe({
            luminanceMask: barrier.luminanceMask,
            annotationsMask: barrier.annotationsMask,
            imgWidth: barrier.width,
            imgHeight: barrier.height,
            seed,
            loupeBBox: {
              x: loupeBBox.x, y: loupeBBox.y,
              width: loupeBBox.width, height: loupeBBox.height,
            },
            orthoAngleRad,
          });
          if (fill) {
            const raw = traceMaskContour({
              mask: fill.mask,
              width: fill.width,
              height: fill.height,
              offsetX: fill.offsetX,
              offsetY: fill.offsetY,
            });
            // Same post-processing as the live runner so the committed
            // polygon matches what the user would have previewed.
            rawImgPxPoints = orthogonalizeIfRectangle(raw, orthoAngleRad);
          }
        }
      }

      if (!rawImgPxPoints || rawImgPxPoints.length < 3) {
        return; // nothing to commit
      }

      const toLocal = (p) => ({
        x: p.x * baseMapImageScale + baseMapImageOffset.x,
        y: p.y * baseMapImageScale + baseMapImageOffset.y,
      });
      const rawLocalPoints = rawImgPxPoints.map(toLocal);

      let localPoints;
      if (rawDetection) {
        localPoints = rawLocalPoints;
      } else {
        ({ points: localPoints } = alignPolygonsToGrid(
          rawLocalPoints,
          undefined,
          {
            referenceAngle: orthoSnapAngleOffsetRef.current || null,
            meterByPx: baseMapMeterByPx || 0,
          }
        ));
      }

      const CONVEX_HULL_THRESHOLD = 42;
      let finalPoints = localPoints;
      if (convexHullEnabled && localPoints.length > CONVEX_HULL_THRESHOLD) {
        finalPoints = convexHull(localPoints);
      }

      const topMiddlePoint = getTopMiddlePoint(finalPoints);
      const pose = getTargetPose();
      const worldX = topMiddlePoint.x * pose.k + pose.x;
      const worldY = topMiddlePoint.y * pose.k + pose.y;
      const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);
      if (onCommitPointsFromSurfaceDrop) {
        onCommitPointsFromSurfaceDrop({ points: finalPoints, cuts: undefined, screenPos });
      }

      // Clear preview — the freshly committed annotation will be ORed
      // into the barrier mask on the next render, so the next mouse move
      // starts from a clean state.
      surfaceDropPreviewImgPxRef.current = null;
      dispatch(setSurfaceDropPreview(null));
    }

    // -- CASE 4b: SURFACE_DROP legacy (smartDetect OFF → opencv contour detection)
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

      // Check if a POLYLINE is closed (closeLine flag or first point = last point).
      const isClosedPolyline = (a) => {
        if (a.type !== "POLYLINE") return false;
        if (a.points?.length < 3) return false;
        if (a.closeLine) return true;
        const first = a.points[0];
        const last = a.points[a.points.length - 1];
        return first.x === last.x && first.y === last.y;
      };

      // Collect visible POLYGON + closed POLYLINE annotations as filled barriers
      // (in source image pixel coords). Closed polylines are treated as solid
      // polygons so the flood fill cannot leak through them.
      const boundaries = (annotations || [])
        .filter(a =>
          (a.type === "POLYGON" && a.points?.length >= 3) ||
          isClosedPolyline(a)
        )
        .map(a => ({
          points: a.points.map(p => ({
            x: (p.x - baseMapImageOffset.x) / baseMapImageScale,
            y: (p.y - baseMapImageOffset.y) / baseMapImageScale,
          })),
          cuts: a.cuts?.map(cut => ({
            ...cut,
            points: cut.points.map(p => ({
              x: (p.x - baseMapImageOffset.x) / baseMapImageScale,
              y: (p.y - baseMapImageOffset.y) / baseMapImageScale,
            })),
          })),
        }));

      const { points, cuts } = await cv.detectContoursAsync({
        imageUrl: baseMapImageUrl,
        x: pixelX,
        y: pixelY,
        viewportBBox,
        boundaries,
        skipApproxPoly: rawDetection,
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

      let localPoints, localCuts;
      if (rawDetection) {
        localPoints = rawLocalPoints;
        localCuts = rawLocalCuts;
      } else {
        ({ points: localPoints, cuts: localCuts } = alignPolygonsToGrid(
          rawLocalPoints,
          rawLocalCuts,
          {
            referenceAngle: orthoSnapAngleOffsetRef.current || null,
            meterByPx: baseMapMeterByPx || 0,
          }
        ));
      }

      const filteredCuts = filterSurfaceDropCuts(localCuts, {
        noCuts,
        noSmallCuts,
        baseMapImageScale,
      });

      // Apply convex hull to polygons with too many points (> 42)
      const CONVEX_HULL_THRESHOLD = 42;
      let finalPoints = localPoints;
      let finalCuts = filteredCuts;
      if (convexHullEnabled) {
        if (localPoints.length > CONVEX_HULL_THRESHOLD) {
          finalPoints = convexHull(localPoints);
        }
        if (finalCuts) {
          finalCuts = finalCuts.map((cut) =>
            cut.points?.length > CONVEX_HULL_THRESHOLD
              ? { ...cut, points: convexHull(cut.points) }
              : cut
          );
        }
      }

      const topMiddlePoint = getTopMiddlePoint(finalPoints);
      const pose = getTargetPose(); // getTargetPose retourne basePose par défaut
      const worldX = topMiddlePoint.x * pose.k + pose.x;
      const worldY = topMiddlePoint.y * pose.k + pose.y;
      const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);
      if (onCommitPointsFromSurfaceDrop) {
        onCommitPointsFromSurfaceDrop({ points: finalPoints, cuts: finalCuts, screenPos });
      }
    }

    // -- CASE 5: COLOR_PICKER (pick a pixel color from the base map)
    else if (enabledDrawingMode === "COLOR_PICKER") {
      const localPos = toLocalCoords(worldPos);
      const pixelX = (localPos.x - baseMapImageOffset.x) / baseMapImageScale;
      const pixelY = (localPos.y - baseMapImageOffset.y) / baseMapImageScale;
      await cv.load();
      const { colorHex } = await cv.getPixelColorAsync({
        imageUrl: baseMapImageUrl,
        x: pixelX,
        y: pixelY,
      });
      if (colorHex) {
        dispatch(setColorToReplace(colorHex));
      }
      dispatch(setEnabledDrawingMode(null));
    }

    else if (enabledDrawingMode === "SMART_DETECT") {
      commitPolyline(event);
    }

    else if (!enabledDrawingMode) {
      const nativeTarget = event.nativeEvent?.target || event.target;

      // A0. Image-mode LEGEND selection.
      // Independent of showBgImage / selectedNode plumbing: a click on the
      // legend toggles a dedicated flag, and any click elsewhere clears it.
      // This drives EditedLegendLayer's chrome (frame + resize handles).
      if (imageModeEnabledRef.current) {
        const hitLegend = nativeTarget.closest?.('[data-node-type="LEGEND"]');
        if (hitLegend) {
          dispatch(setImageModeLegendSelected(true));
          return;
        } else if (imageModeLegendSelectedRef.current) {
          dispatch(setImageModeLegendSelected(false));
          // fall through — other selections may still apply
        }
      }

      // A. DÉTECTION DU CLIC SUR UN POINT (VERTEX)
      // Les points auront data-node-type="VERTEX"
      const hitPoint = nativeTarget.closest?.('[data-node-type="VERTEX"]');

      if (hitPoint) {
        const { pointId, annotationId } = hitPoint.dataset;

        // SELECT mode: usePointDrag is gated (no drag), so handle vertex
        // click selection here. Mirrors the usePointDrag CAS B behavior so
        // clicks on points behave identically across modes:
        //   shift+click → toggle in multi-selection
        //   click on already-selected point → toggle its type (square ↔ circle)
        //   click on unselected point → select it
        // We also auto-select the parent annotation when starting from a
        // fresh state, since SELECT mode users can click a vertex directly.
        if (interactionMode === "SELECT") {
          const isAlreadySelected = selectedPointIds.includes(pointId);
          if (selectedNode?.nodeId !== annotationId) {
            const annotation = annotations?.find((a) => a.id === annotationId);
            dispatch(setSelectedItem({
              id: annotationId,
              nodeId: annotationId,
              type: "NODE",
              nodeType: "ANNOTATION",
              annotationType: annotation?.type,
              entityId: annotation?.entityId,
              listingId: annotation?.listingId,
              annotationTemplateId: annotation?.annotationTemplateId,
              partId: null,
              partType: null,
            }));
          }
          if (event.shiftKey) {
            dispatch(toggleSelectedPointId(pointId));
            if (isAlreadySelected) {
              // Point removed from the multi-selection: don't force it back as
              // the representative — the reducer reconciles to a remaining
              // point (or clears it), so it deselects immediately.
              return;
            }
          } else if (isAlreadySelected) {
            onToggleAnnotationPointType?.({ pointId, annotationId });
          } else {
            dispatch(setSelectedPointIds([pointId]));
          }
          dispatch(setSubSelection({ pointId, partType: "VERTEX" }));
          return;
        }

        // Si l'annotation est déjà sélectionnée, on gère le shift+click
        if (selectedNode?.nodeId === annotationId) {
          if (event.shiftKey) {
            // Shift+click: toggle point in multi-selection
            const wasSelected = selectedPointIds.includes(pointId);
            dispatch(toggleSelectedPointId(pointId));
            // Only make the point the representative when ADDING it. When
            // removing, leave the representative to the reducer's reconcile so
            // the clicked point deselects immediately (otherwise it stays
            // highlighted until another point is clicked).
            if (!wasSelected) {
              dispatch(setSubSelection({ pointId, partType: "VERTEX" }));
            }
          }
          // Normal click selection + toggle type is handled by usePointDrag mouseUp
          return;
        }
      } else if (!event.shiftKey) {
        // Plain click elsewhere (on the line or empty) deselects the points.
        // A shift+click never auto-clears points: it is additive (e.g. adding a
        // segment to a mixed points + segments selection).
        if (selectedPointId) dispatch(setSubSelection({ pointId: null }));
        if (selectedPointIds.length > 0) dispatch(clearSelectedPointIds());
      }

      // 2. Ensuite les Parts (Segments / Contours)
      // On cherche un élément avec data-part-id
      const hitPart = nativeTarget.closest?.('[data-part-id]');

      if (hitPart) {
        const { partId, nodeId, partType } = hitPart.dataset;
        const isParentSelected = selectedNode?.nodeId === nodeId;

        if (isParentSelected) {
          const isMultiSelectable =
            partType === "SEG" || partType === "CUT_SEG" || partType === "CUT";
          if (event.shiftKey && isMultiSelectable) {
            // Keep any existing point selection: shift+click on a segment adds
            // it to the mixed (points + segments) selection rather than
            // replacing the vertices, so the user can curate both kinds.
            // Multi-segment selection. The first shift+click after a single
            // segment selection has to PROMOTE the existing selectedPartId
            // into selectedPartIds — otherwise toggling only ever tracks the
            // latest click and the original selection is lost.
            const alreadyInMulti = selectedPartIds.includes(partId);
            // Compute the post-dispatch multi state so we can sync the
            // single-selection slot to a still-selected part (otherwise the
            // green highlight sticks to the segment we just removed).
            let nextMulti;
            if (selectedPartIds.length === 0) {
              nextMulti = [];
              if (selectedPartId && selectedPartId !== partId) nextMulti.push(selectedPartId);
              nextMulti.push(partId);
              dispatch(setSelectedPartIds(nextMulti));
            } else if (alreadyInMulti && selectedPartIds.length > 1) {
              nextMulti = selectedPartIds.filter((id) => id !== partId);
              dispatch(toggleSelectedPartId(partId));
            } else if (alreadyInMulti) {
              nextMulti = [];
              dispatch(clearSelectedPartIds());
            } else {
              nextMulti = [...selectedPartIds, partId];
              dispatch(toggleSelectedPartId(partId));
            }
            console.log("Toggle Part Selection:", partId, partType, "nextMulti=", nextMulti);
            // Pick a representative for the single-selection slot:
            // - if the clicked part is still in the multi → it stays current
            // - else fall back to any remaining part, or clear
            let nextSinglePartId = null;
            let nextSinglePartType = null;
            if (nextMulti.includes(partId)) {
              nextSinglePartId = partId;
              nextSinglePartType = partType;
            } else if (nextMulti.length > 0) {
              nextSinglePartId = nextMulti[0];
              nextSinglePartType = nextSinglePartId.split("::")[1];
            }
            dispatch(setSubSelection({
              partId: nextSinglePartId,
              partType: nextSinglePartType,
            }));
            return;
          }
          console.log("Selecting Part:", partId, partType);
          // Toggle single part selection — clears any multi-part state.
          if (selectedPartIds.length > 0) {
            dispatch(clearSelectedPartIds());
          }
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

    // CAPTURE / image mode: no snap, no hover detection on annotations.
    // We still record the screen pos so pan/zoom cursor updates stay
    // accurate, but everything below early-returns.
    if (imageModeEnabledRef.current) {
      lastMouseScreenPosRef.current = {
        screenPos: { x: event.clientX, y: event.clientY },
        viewportPos,
      };
      return;
    }

    lastMouseScreenPosRef.current = {
      screenPos: { x: event.clientX, y: event.clientY },
      viewportPos: viewportPos
    };

    // Paste ghost follows the cursor in local image-pixel space.
    if (pasteClipboardRef.current) {
      const localPos = toLocalCoords(worldPos);
      pastePreviewLayerRef.current?.updatePreview(localPos);

      // HOVER pattern detection: scan a window around the cursor.
      if (
        pasteDetectionModeRef.current === "HOVER" &&
        pasteDetectImageDataRef.current
      ) {
        const scale = baseMapImageScaleRef.current || 1;
        const offset = baseMapImageOffsetRef.current || { x: 0, y: 0 };
        runPatternDetectHover({
          x: (localPos.x - offset.x) / scale,
          y: (localPos.y - offset.y) / scale,
        });
      }
    }

    const showSmartDetect = showSmartDetectRef.current;
    const dragState = dragStateRef.current;
    const dragAnnotationState = dragAnnotationStateRef.current;

    if (lassoRect) {
      updateLasso(event);
      return;
    }

    if (pointLassoRect) {
      updatePointLasso(event);
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
          guideLine: ann.guideLine?.filter(
            (g) => g.pointId !== dragPointId && g.id !== dragPointId
          ),
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
    // Shift outside drawing means the user is starting a selection (lasso or
    // shift+click). Snap helpers would intercept the click — suppress them.
    const isShiftSelection = !enabledDrawingMode && Boolean(event.shiftKey || event.evt?.shiftKey);
    const preventSnapping = isPanning || dragAnnotationState?.active || dragBaseMapState?.active || POINTER_CLICK_MODES.includes(enabledDrawingMode) || interactionMode === "SELECT" || isShiftSelection;

    let snapResult;
    if (snappingEnabled && !preventSnapping) {

      const imageScale = getTargetScale();
      const currentCameraZoom = viewportRef.current?.getZoom() || 1;
      const scale = imageScale * currentCameraZoom;
      const localPos = toLocalCoords(worldPos);
      const snapThreshold = SNAP_THRESHOLD_ABSOLUTE / scale;

      const snapModes = getSnapModes({
        isDrawing: Boolean(enabledDrawingMode),
        isQuickEdit:
          mapEditorMode === "QUICK_POINTS_CHANGE" ||
          interactionMode === "DRAW",
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
    if (['CLICK', 'POLYLINE_CLICK', 'POLYGON_CLICK', 'CUT_CLICK', 'SPLIT_CLICK', 'STRIP', 'ONE_CLICK', "MEASURE", "RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE", "ARC", "POLYLINE_ARC", "COMPLETE_ANNOTATION", "COTE_TWO_CLICK", "ADD_GUIDE_LINE"].includes(enabledDrawingMode)) {
      const localPos = toLocalCoords(worldPos);
      let previewPos = localPos;

      // Angle snap drawing (use ref to always get latest points, even before re-render)
      const currentDrawingPts = drawingPointsRef.current;
      if ((event.shiftKey || event.evt?.shiftKey || orthoSnapEnabledRef.current) && currentDrawingPts.length > 0) {
        const lastPoint = currentDrawingPts[currentDrawingPts.length - 1];
        const offset = orthoSnapAngleOffsetRef.current;
        previewPos = snapToAngle(localPos, lastPoint, offset);
      }

      // F. CLOSING DETECTION (screen-distance based, zoom-independent)
      const closingType = newAnnotation?.type;
      const canClose = (closingType === "POLYGON" || closingType === "POLYLINE" || closingType === "CUT") && currentDrawingPts.length >= 3;
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

      // G. FIXED LENGTH CONSTRAINT + SEGMENT LENGTH METRICS
      const lastPt = currentDrawingPts[currentDrawingPts.length - 1];
      if (lastPt && fixedLengthRef.current) {
        const mbp = meterByPxRef.current;
        const hasScale = Number.isFinite(mbp) && mbp > 0;
        previewPos = applyFixedLengthConstraint({
          lastPointPx: lastPt,
          candidatePointPx: previewPos,
          fixedLengthMeters: fixedLengthRef.current,
          meterPerPixel: hasScale ? mbp : 1, // no scale => value is in px
        });
      }
      if (lastPt && segmentLengthPxRef) {
        const dx = previewPos.x - lastPt.x;
        const dy = previewPos.y - lastPt.y;
        segmentLengthPxRef.current = Math.hypot(dx, dy);
      } else if (segmentLengthPxRef) {
        segmentLengthPxRef.current = 0;
      }

      lastPreviewPosRef.current = previewPos;
      drawingLayerRef.current?.updatePreview(previewPos);
    }

    // --- POLYGON (SURFACE) DETECTION FROM ANNOTATIONS ---
    // Only runs when smart detect is enabled on POLYGON_CLICK.
    if (
      enabledDrawingModeRef.current === "POLYGON_CLICK" &&
      smartDetectEnabledRef.current
    ) {
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
    // Drives the loupe visual + ROI. The heavy OpenCV analysis is gated
    // downstream in updateSmartDetect via detectionTarget.
    const _detTargetMove = getEffectiveDetectionMode({
      enabledDrawingMode,
      smartDetectEnabled,
    });
    if (
      enabledDrawingMode === "SMART_DETECT" ||
      _detTargetMove === "STRIP" ||
      _detTargetMove === "SEGMENT" ||
      showSmartDetect
    ) {
      updateSmartDetect(lastMouseScreenPosRef.current);
    }

    // --- STRIP / SEGMENT auto-detection: throttled detection from loupe ---
    if (_detTargetMove === "STRIP" || _detTargetMove === "SEGMENT") {
      const localPos = toLocalCoords(worldPos);
      const cursorImgPx = {
        x: (localPos.x - baseMapImageOffset.x) / baseMapImageScale,
        y: (localPos.y - baseMapImageOffset.y) / baseMapImageScale,
      };
      // Skip if cursor hasn't moved enough (in image pixels) since last detect.
      const last = lastStripDetectCursorRef.current;
      const moved = !last
        || Math.abs(cursorImgPx.x - last.x) > 1
        || Math.abs(cursorImgPx.y - last.y) > 1;
      const loupeBBox = lastSmartROI.current
        ? {
            x: lastSmartROI.current.x,
            y: lastSmartROI.current.y,
            width: lastSmartROI.current.width,
            height: lastSmartROI.current.height,
          }
        : null;
      if (moved && loupeBBox) {
        lastStripDetectCursorRef.current = cursorImgPx;
        runStripDetectionFromLoupe(cursorImgPx, loupeBBox);
      }
    }

    // --- SURFACE_DROP smartDetect: loupe-bounded JS flood-fill preview ---
    if (smartDetectEnabled && enabledDrawingMode === "SURFACE_DROP") {
      const localPos = toLocalCoords(worldPos);
      const cursorImgPx = {
        x: (localPos.x - baseMapImageOffset.x) / baseMapImageScale,
        y: (localPos.y - baseMapImageOffset.y) / baseMapImageScale,
      };
      const last = surfaceDropLastCursorRef.current;
      const moved = !last
        || Math.abs(cursorImgPx.x - last.x) > 1
        || Math.abs(cursorImgPx.y - last.y) > 1;
      const loupeBBox = lastSmartROI.current
        ? {
            x: lastSmartROI.current.x,
            y: lastSmartROI.current.y,
            width: lastSmartROI.current.width,
            height: lastSmartROI.current.height,
          }
        : null;
      if (moved && loupeBBox && surfaceDropBarrierMaskRef.current) {
        surfaceDropLastCursorRef.current = cursorImgPx;
        runSurfaceDropFloodFill(cursorImgPx, loupeBBox);
      }
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
    // CAPTURE / image mode: skip snap markers entirely.
    if (imageModeEnabledRef.current) return;
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

      // --- COMPLETE_ANNOTATION: identify target annotation on first vertex click ---
      if (enabledDrawingMode === "COMPLETE_ANNOTATION") {
        // Determine which annotation this snap belongs to
        const snapAnnotationId = snap.annotationId || snap.previewAnnotationId;

        if (!completeAnnotationRef.current) {
          // First click: identify the annotation via VERTEX, MIDPOINT, or PROJECTION
          if (!snapAnnotationId) {
            dispatch(setToaster({ message: "Cliquez sur un point existant", isError: true }));
            setDrawingPoints([]);
            drawingPointsRef.current = [];
            return;
          }

          // For VERTEX: check that it belongs to exactly 1 annotation
          if (snap.type === "VERTEX") {
            const pointId = snap.id;
            const matchingAnnotations = (annotations || []).filter(
              (a) =>
                (a.type === "POLYLINE" || a.type === "POLYGON") &&
                a.points?.some((p) => p.id === pointId)
            );

            if (matchingAnnotations.length > 1) {
              dispatch(setToaster({ message: "Plusieurs annotations appartiennent à ce point", isError: true }));
              setDrawingPoints([]);
              drawingPointsRef.current = [];
              return;
            }
          }

          const targetAnnotation = (annotations || []).find(
            (a) => a.id === snapAnnotationId &&
              (a.type === "POLYLINE" || a.type === "POLYGON")
          );
          if (!targetAnnotation) {
            dispatch(setToaster({ message: "Cliquez sur un point existant", isError: true }));
            setDrawingPoints([]);
            drawingPointsRef.current = [];
            return;
          }

          completeAnnotationRef.current = { id: targetAnnotation.id, type: targetAnnotation.type };
          completeStartPointRef.current = snap.type === "VERTEX" ? snap.id : null;

          const color = getAnnotationColor(targetAnnotation);
          dispatch(setNewAnnotation({
            ...newAnnotationRef.current,
            strokeColor: color,
            fillColor: color,
          }));
        } else if (snapAnnotationId === completeAnnotationRef.current.id) {
          // Subsequent click on the same annotation (VERTEX, PROJECTION, or MIDPOINT) → commit
          const endPointId = snap.type === "VERTEX" ? snap.id : null;
          if (snap.type === "VERTEX" && snap.id === completeStartPointRef.current) {
            // Clicking on the same start point — ignore
          } else {
            commitPolyline(e, {
              completeAnnotationId: completeAnnotationRef.current.id,
              startPointId: completeStartPointRef.current,
              endPointId,
            });
            completeAnnotationRef.current = null;
            completeStartPointRef.current = null;
            return;
          }
        }
      }

      // --- CORRECTION DU BUG "ONE_CLICK" ---
      if (enabledDrawingMode === 'ONE_CLICK') {
        // Si on est en mode un seul clic (Marker/Point), on commit tout de suite !
        commitPoint();
      }

      else if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "MEASURE", "SEGMENT", "COTE_TWO_CLICK"].includes(enabledDrawingMode) && newPointsList?.length === 2) {
        commitPolyline(e); // add "e" to get clientX & clientY to set the measurePopper anchor position.
      }

      else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE", "ARC", "POLYLINE_ARC"].includes(enabledDrawingMode) && newPointsList?.length === 3) {
        drawingPointsRef.current = newPointsList;
        commitPolyline(e);
      }

      // On s'arrête ici
      return;
    }
    // =======================================================

    // --- CAS 1 & 2 : VERTEX ou PROJECTION — délégué à usePointDrag ---
    // Inclut la logique de permission + fork automatique pour les points partagés
    // En mode SELECT, les vertices restent visibles mais ne sont pas interactifs.
    if (interactionMode !== "SELECT") {
      handleVertexOrProjectionMouseDown(snap, e);

      //snappingLayerRef.current?.update(null); // hide snapping circle // on hide au move

      // FORCE CURSOR ON BODY
      document.body.style.cursor = 'crosshair';
    }
  };


  // --- 3. MOUSE UP (Global) ---
  const handleMouseUp = (event) => {

    // CAPTURE / image mode: no annotation drag to finalize.
    if (imageModeEnabledRef.current) return;

    // Lasso end. When the gesture was a click (committed: false), fall back to
    // the shift+click toggle logic so toggling a single point / segment /
    // annotation still works (the viewport never saw this mouseDown — we
    // stopPropagation'd it — so it won't fire onWorldClick itself).
    if (lassoRect || pointLassoRect) {
      const { committed } = lassoRect ? endLasso() : endPointLasso();
      if (!committed) {
        const worldPos = viewportRef.current?.screenToWorld(
          event.clientX,
          event.clientY
        );
        const { viewportPos } =
          viewportRef.current?.getMousePositions(event) || {};
        handleWorldClick({ event, worldPos, viewportPos });
      }
      return;
    }


    const dragState = dragStateRef.current;
    const dragAnnotationState = dragAnnotationStateRef.current;

    console.log('handleMouseUp_dragAnnotationState', dragAnnotationState);


    // Point drag takes priority over annotation click (avoid resetting selectedPointIds)
    if (dragState?.pending) {
      const handled = handlePointDragEnd(event);
      if (handled) {
        handleAnnotationDragEnd(); // cleanup annotation pending state
        return;
      }
    }

    // click sur un vertex ou une annotation
    if (!dragAnnotationState?.active && dragAnnotationState?.pending) {

      const annotationId = dragAnnotationState.selectedAnnotationId;
      const annotation = annotations?.find((a) => a.id === annotationId);

      let panelAnchor = null;
      if (annotation) panelAnchor = getAnnotationEditionPanelAnchor(annotation);

      console.log("debug_2701_click_on_annotation", annotation, panelAnchor);

      // EDIT mode shortcut: replace annotation's template with the
      // currently selected ANNOTATION_TEMPLATE (sticky cursor) and exit
      // without overwriting the selection.
      {
        const editTarget = selectedItems[0];
        if (
          interactionMode === "EDIT" &&
          editTarget?.type === "ANNOTATION_TEMPLATE" &&
          editTarget.id &&
          annotation &&
          annotation.annotationTemplateId !== editTarget.id
        ) {
          updateAnnotationService({
            id: annotation.id,
            annotationTemplateId: editTarget.id,
          });
          handleAnnotationDragEnd();
          return;
        }
      }

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
    // (pending clicks are handled earlier to avoid selectedPointIds reset)
    if (dragState?.active) {
      const handled = handlePointDragEnd(event);
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

    // CAPTURE / image mode: skip all annotation drag / resize / select
    // logic. Pan still works via MapEditorViewport's own onMouseDown.
    if (imageModeEnabledRef.current) return;

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

    // Si Shift est pressé -> Lasso (annotation-level or point-level)
    //
    // A shift+drag always starts a lasso, wherever it begins (over an
    // annotation, a segment, a vertex or empty space). stopPropagation here
    // prevents MapEditorViewport from interpreting the drag as a pan. When the
    // gesture turns out to be a click (no real movement), the lasso hook
    // reports `committed: false` on mouseUp and handleMouseUp falls back to the
    // shift+click toggle logic (handleWorldClick) — so individual point /
    // segment / annotation toggles keep working.
    //
    // Routing: a single selected annotation enters the point/segment lasso
    // (refine that annotation's vertices & edges); zero or several selected
    // annotations enter the annotation-level lasso (select whole annotations).

    if (e.shiftKey && !enabledDrawingModeRef.current) {
      const singleAnnotationSelected =
        selectedNodes?.length === 1 && !!selectedNode?.nodeId;

      const started = singleAnnotationSelected
        ? startPointLasso(e)
        : startLasso(e);
      if (started) {
        e.stopPropagation();
        return;
      }
    }


    console.log("debug_A_selectedNode", selectedNode)
    if (!selectedNode && !showBgImage && !draggableGroup && !resizeHandle && !rotateHandle && !versionHandle && !calibrationHandle && !legendHandle) return;



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
      const { targetColor, versionId: dragVersionId } = calibrationHandle.dataset;
      initCalibrationDrag(targetColor, e, dragVersionId);
    }


  }

  const handleMouseLeave = () => {
    setTooltipData(null);
  };


  function handleContextMenu(e) {
    e.preventDefault();

    // CAPTURE / image mode: suppress the context menu entirely (preventDefault
    // already blocks the browser menu, just bail before the annotation logic).
    if (imageModeEnabledRef.current) return;

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

  // Double-click on the already-selected annotation (no sub-selection active)
  // selects every segment of the annotation — main contour + cut rings. The
  // user uses this as a quick "select all segments" shortcut so they can clone
  // / measure them in one shot.
  const handleDoubleClick = (event) => {
    if (imageModeEnabledRef.current) return;
    if (enabledDrawingMode) return;
    const target = event.nativeEvent?.target || event.target;
    const hit = target.closest?.('[data-node-type="ANNOTATION"]');
    if (!hit) return;
    const annotationId = hit.dataset?.nodeId;
    if (!annotationId) return;
    if (selectedNode?.nodeId !== annotationId) return;

    const currentItem = selectedItems[0];
    const hasSubSelection =
      currentItem?.partId ||
      currentItem?.pointId ||
      selectedPartIds.length > 0 ||
      selectedPointIds.length > 0;
    if (hasSubSelection) return;

    const annotation = annotations?.find((a) => a.id === annotationId);
    if (!annotation) return;
    const segs = getAnnotationLassoSegments(annotation);
    const partIds = segs.map((s) => s.partId);
    if (partIds.length === 0) return;

    dispatch(setSelectedPartIds(partIds));
    const firstId = partIds[0];
    const partType = firstId.includes("::CUT_SEG::") ? "CUT_SEG" : "SEG";
    dispatch(setSubSelection({ partId: firstId, partType, pointId: null }));
    if (selectedPointIds.length > 0) dispatch(clearSelectedPointIds());
  };

  return (
    <Box
      onMouseUp={handleMouseUp}
      onMouseDownCapture={handleMouseDownCapture}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      sx={{
        width: 1, height: 1, // A. Le curseur de base du conteneur
        cursor: getCursorStyle(),

        // B. L'Override "Nucléaire" pour le mode dessin
        // Si on dessine, on force TOUS les enfants (& *) à avoir crosshair
        // Sauf pour les modes de sélection de segment (pointer)
        ...(enabledDrawingMode && !POINTER_CLICK_MODES.includes(enabledDrawingMode) && {
          '& *': {
            cursor: 'crosshair !important',
          },
        }),
        ...(POINTER_CLICK_MODES.includes(enabledDrawingMode) && {
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
            visible={(!!enabledDrawingMode && !POINTER_CLICK_MODES.includes(enabledDrawingMode)) || dragState?.active}
            newAnnotation={newAnnotation}
            rotationAngle={orthoSnapAngleOffset || 0}
            crosshairAxis={
              smartDetectEnabled &&
              (enabledDrawingMode === "STRIP" ||
                enabledDrawingMode === "POLYLINE_CLICK" ||
                enabledDrawingMode === "SURFACE_DROP")
                ? stripDetectionOrientation
                : "BOTH"
            }
            showZoomRect={
              Boolean(enabledDrawingMode) &&
              !NO_SMART_DETECT_MODES.includes(enabledDrawingMode) &&
              (
                !smartDetectEnabled ||
                newAnnotation?.drawingShape === "POLYLINE" ||
                enabledDrawingMode === "SURFACE_DROP"
              )
            }
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
            <Box data-capture-hide sx={{ position: 'absolute', bottom: "16px", left: "76px", zIndex: 1 }}>
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
                data-capture-hide
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
          <TransientDetectedStripsLayer ref={transientDetectedStripsRef} />
          <TransientDetectedPolygonLayer ref={transientDetectedPolygonRef} />
          <TransientDetectedPatternLayer
            ref={transientDetectedPatternRef}
            containerK={targetPose.k}
          />
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
              containerK={targetPose.k}
              virtualInsertion={virtualInsertion}
              selectedAnnotationId={selectedNode?.nodeId?.replace("label::", "")}
            />
          </g>
        )}


        {/* --- Overlay optimiste : visible pendant le drag ET en attente de convergence DB --- */}
        {(() => {
          // Wrapper mode: active drag OR convergence (pending moves remain after mouseUp)
          const POINT_BASED_TYPES_T = ["POLYLINE", "POLYGON", "STRIP", "COTE"];

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
              orthoSnapAngleOffset={orthoSnapAngleOffset}
            />
          </g>

        )}

        {pasteClipboard && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <PasteAnnotationPreviewLayer ref={pastePreviewLayerRef} />
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
          loupeWidth={loupeAspectRedux === "PORTRAIT" ? LOUPE_SIZE / LOUPE_ASPECT_RATIO : LOUPE_SIZE}
          loupeHeight={loupeAspectRedux === "LANDSCAPE" ? LOUPE_SIZE / LOUPE_ASPECT_RATIO : LOUPE_SIZE}
          onSmartShapeDetected={handleSmartShapeDetected}
          enabled={enabledDrawingMode === 'SMART_DETECT' || showSmartDetectRef.current}
          initialDetectMode={
            getEffectiveDetectionMode({ enabledDrawingMode, smartDetectEnabled }) === "RECTANGLE" ? "RECTANGLE"
            : (enabledDrawingMode === "POLYLINE_CLICK" && advancedLayout) ? "ORTHO_PATHS"
            : undefined
          }
          loupeOnly={
            // Only RECTANGLE / SMART_DETECT exercise the OpenCV path inside
            // SmartDetectLayer. Everything else is visual-only — STRIP /
            // SEGMENT run JS detection outside the layer, SURFACE runs on
            // annotations, no-detect modes run nothing.
            !(
              getEffectiveDetectionMode({ enabledDrawingMode, smartDetectEnabled }) === "RECTANGLE" ||
              enabledDrawingMode === "SMART_DETECT"
            )
          }
          orthoSnapAngleOffset={orthoSnapAngleOffset}
          disableShortcuts={
            // Our CardSmartDetect uses "O" for H/V orientation on STRIP and
            // POLYLINE_CLICK — silence the SmartDetectLayer internal "O"
            // (ORTHO_PATHS toggle) for those modes.
            enabledDrawingMode === "STRIP" || enabledDrawingMode === "POLYLINE_CLICK"
              ? ["O"]
              : []
          }
        />, zoomContainer) : null}
      </>

      <LassoOverlay rect={lassoRect} />
      <LassoOverlay rect={pointLassoRect} />

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