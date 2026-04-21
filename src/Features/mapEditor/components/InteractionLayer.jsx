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
import {
  setAnchorSourceAnnotationId,
  setOrthoSnapEnabled,
  setFixedLength,
  setStripDetectionOrientation,
  toggleStripDetectionOrientation,
  toggleSmartDetectEnabled,
  cycleLoupeAspect,
  setLoupeAspect,
  setSmartDetectionPresent,
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
  setShowAnnotationsProperties
} from "Features/selection/selectionSlice";

import useResetNewAnnotation from 'Features/annotations/hooks/useResetNewAnnotation';
import useLassoSelection from 'Features/mapEditorGeneric/hooks/useLassoSelection';
import useLassoPointSelection from 'Features/annotations/hooks/useLassoPointSelection';
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
import TransientDetectedStripsLayer from 'Features/mapEditorGeneric/components/TransientDetectedStripsLayer';
import TransientDetectedPolygonLayer from 'Features/mapEditorGeneric/components/TransientDetectedPolygonLayer';
import detectPolygonFromAnnotations from 'Features/smartDetect/utils/detectPolygonFromAnnotations';
import detectStripFromLoupe from 'Features/smartDetect/utils/detectStripFromLoupe';
import buildExclusionMask from 'Features/smartDetect/utils/buildExclusionMask';
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
const SMART_ZOOM_DEFAULT = 3.0; // Facteur de grossissement par défaut
const SMART_ZOOM_MIN = 1.0;
const SMART_ZOOM_MAX = 20.0;
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
  onCommitSimilarStrips,
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
  onDeletePoints,
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
  onCameraChangeExternal,
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
  const transientOrthoPathsRef = useRef(null);
  const detectedOrthoPathsRef = useRef(null); // current ortho detection results (image coords)
  const committedOrthoSegmentsRef = useRef([]); // accumulated committed segments for exclusion
  const transientDetectedPolygonRef = useRef(null);
  const detectedPolygonRef = useRef(null); // current polygon detection result { outerRing, cuts }
  const transientDetectedStripsRef = useRef(null);
  const detectedSimilarStripsRef = useRef(null); // { strips, sourceAnnotation }
  const detectedShapeRef = useRef(null); // current rectangle detection { type, points }
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
  const selectedPointIds = useSelector(selectSelectedPointIds);

  // Computed selectedNode equivalent (first item)
  const { node: selectedNode } = useSelectedNodes();

  // Anchor snap mode
  const anchorSourceAnnotationId = useSelector((s) => s.mapEditor.anchorSourceAnnotationId);
  const mapEditorMode = useSelector((s) => s.mapEditor.mapEditorMode);
  const orthoSnapEnabled = useSelector((s) => s.mapEditor.orthoSnapEnabled);
  const orthoSnapAngleOffset = useSelector((s) => s.mapEditor.orthoSnapAngleOffset);
  const stripDetectionOrientation = useSelector((s) => s.mapEditor.stripDetectionOrientation);
  const stripDetectionMultiple = useSelector((s) => s.mapEditor.stripDetectionMultiple);
  const smartDetectEnabled = useSelector((s) => s.mapEditor.smartDetectEnabled);
  const loupeAspectRedux = useSelector((s) => s.mapEditor.loupeAspect);
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const rawDetection = useSelector((s) => s.smartDetect.rawDetection);
  const noCuts = useSelector((s) => s.smartDetect.noCuts);
  const noSmallCuts = useSelector((s) => s.smartDetect.noSmallCuts);
  const convexHullEnabled = useSelector((s) => s.smartDetect.convexHull);
  const visibleAreaOnly = useSelector((s) => s.smartDetect.visibleAreaOnly);
  const { zoomContainer } = useSmartZoom();
  const { segmentLengthPxRef, constraintBuffer, appendToBuffer, deleteFromBuffer, clearBuffer } = useDrawingMetrics();

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

  // Re-computes smartDetectionPresent from the three detection refs and
  // dispatches only when the aggregate boolean changes (dedup).
  const syncSmartDetectionPresent = () => {
    const present = !!(
      detectedShapeRef.current ||
      detectedPolygonRef.current ||
      detectedSimilarStripsRef.current
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
      const strokeWidth = na.strokeWidth ?? 20;
      const strokeWidthUnit = na.strokeWidthUnit ?? "PX";
      const meterByPx = meterByPxRef.current ?? 0;
      const imageScale = baseMapImageScaleRef.current || 1;
      const imageOffset = baseMapImageOffsetRef.current || { x: 0, y: 0 };
      const stripWidthPx =
        strokeWidthUnit === "CM" && meterByPx > 0
          ? Math.abs((strokeWidth * 0.01) / meterByPx / imageScale)
          : Math.abs(strokeWidth / imageScale);
      if (!Number.isFinite(stripWidthPx) || stripWidthPx < 1) return;

      const stripOrientation = na.stripOrientation ?? 1;
      const orientation = stripDetectionOrientationRef.current || "H";
      // Negate so a positive ortho snap offset rotates the scan frame the
      // same way as snapToAngle (Features/mapEditor/utils/snapToAngle.js) and
      // the rectangle / rotated-rect snap utilities (getPolylinePointsFromRectangle.js,
      // mapEditorGeneric/DrawingLayer.jsx) — screen coords with Y pointing down.
      const orthoAngleRad =
        (-(orthoSnapAngleOffsetRef.current || 0) * Math.PI) / 180;
      const detectMultiple = !!stripDetectionMultipleRef.current;

      let results;
      try {
        results = detectStripFromLoupe({
          imageData,
          cursor: cursorImgPx,
          loupeBBox,
          stripWidthPx,
          orientation,
          orthoAngleRad,
          stripOrientation,
          detectMultiple,
          exclusionMask: stripDetectionExclusionMaskRef.current,
          pointsOnMedianAxis: isSegmentMode,
        });
      } catch (err) {
        console.error(`[${mode}] detection error:`, err);
        return;
      }

      if (!results || results.length === 0) {
        detectedSimilarStripsRef.current = null;
        syncSmartDetectionPresent();
        transientDetectedStripsRef.current?.clear();
        return;
      }

      const toLocal = (p) => ({
        x: p.x * imageScale + imageOffset.x,
        y: p.y * imageScale + imageOffset.y,
      });

      // Stroke-width in local map coords — used by SEGMENT_DETECTION preview
      // to build a symmetric quad around the centerline (mirrors the POLYLINE
      // contour used by buildExclusionMask).
      const strokeWidthLocal =
        strokeWidthUnit === "CM" && meterByPx > 0
          ? (strokeWidth * 0.01) / meterByPx
          : strokeWidth;

      const strips = [];
      for (const result of results) {
        if (!result.segments?.length) continue;
        for (const seg of result.segments) {
          const localCenterline = [toLocal(seg.start), toLocal(seg.end)];

          let polygon;
          let segStripOrientation;

          if (isSegmentMode) {
            // Symmetric stroke around the 2-point centerline → quad preview.
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
            // stripOrientation is computed by the algorithm (per segment) so
            // the body lands over the dark wall pixels — overrides the template.
            segStripOrientation = seg.stripOrientation ?? na.stripOrientation;
            const fakeAnnotation = {
              ...na,
              stripOrientation: segStripOrientation,
              points: localCenterline,
            };
            const polys = getStripePolygons(fakeAnnotation, meterByPx);
            polygon = polys?.[0]?.points || [];
          }

          const strip = { centerline: localCenterline, polygon };
          if (!isSegmentMode) strip.stripOrientation = segStripOrientation;
          strips.push(strip);
        }
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

  // sourceImage for smart detect

  const [sourceImageEl, setSourceImageEl] = useState(null);

  // Latest annotations snapshot for STRIP_DETECTION (read at build time only).
  const annotationsRef = useRef(annotations);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  // Use annotationsUpdatedAt as a stable trigger — only rebuild the exclusion mask
  // when annotations are actually created/updated, not on every reference change.
  const annotationsUpdatedAt = useSelector((s) => s.annotations.annotationsUpdatedAt);

  // Build / clear STRIP_DETECTION / SEGMENT_DETECTION caches when the tool
  // activates / deactivates, or when annotations are mutated
  // (annotationsUpdatedAt changes). Heavy work (full-image getImageData +
  // exclusion mask rasterize) is deferred via setTimeout so the click
  // activating the tool isn't blocked.
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

  // Keep loupe aspect consistent with strip-detection orientation: when the
  // user toggles orientation, a LANDSCAPE loupe for a V detection (or
  // PORTRAIT for H) is counter-productive, so auto-flip to the matching
  // aspect. SQUARE stays untouched — it's compatible with both orientations.
  useEffect(() => {
    if (stripDetectionOrientation === "H" && loupeAspectRedux === "PORTRAIT") {
      dispatch(setLoupeAspect("LANDSCAPE"));
    } else if (stripDetectionOrientation === "V" && loupeAspectRedux === "LANDSCAPE") {
      dispatch(setLoupeAspect("PORTRAIT"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripDetectionOrientation]);

  // Reverse coupling: when the user cycles the loupe format (F or ToggleButton),
  // keep the orientation in sync — LANDSCAPE → H, PORTRAIT → V, SQUARE leaves it.
  useEffect(() => {
    if (loupeAspectRedux === "LANDSCAPE" && stripDetectionOrientation !== "H") {
      dispatch(setStripDetectionOrientation("H"));
    } else if (loupeAspectRedux === "PORTRAIT" && stripDetectionOrientation !== "V") {
      dispatch(setStripDetectionOrientation("V"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loupeAspectRedux]);



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

  // Point-level lasso when an annotation is already selected
  const getSelectedAnnotationPoints = useCallback(() => {
    if (!selectedNode?.nodeId) return [];
    const ann = annotations?.find((a) => a.id === selectedNode.nodeId);
    return ann?.points || [];
  }, [selectedNode?.nodeId, annotations]);

  const handlePointLassoSelection = useCallback((pointIds) => {
    dispatch(setSelectedPointIds(pointIds));
  }, [dispatch]);

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

  const onCommitDrawingRef = useRef(onCommitDrawing);
  useEffect(() => {
    onCommitDrawingRef.current = onCommitDrawing;
  }, [onCommitDrawing]);

  const onCommitSimilarStripsRef = useRef(onCommitSimilarStrips);
  useEffect(() => {
    onCommitSimilarStripsRef.current = onCommitSimilarStrips;
  }, [onCommitSimilarStrips]);

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
      enabledDrawingMode,
      permissions,
    };
  }, [selectedNode?.nodeId, selectedPointId, selectedPartId, selectedPointIds, onDeletePoint, onDeletePoints, onHideSegment, onRemoveCut, enabledDrawingMode, permissions]);


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
      const { selectedNode, selectedPointId, selectedPartId, selectedPointIds, onDeletePoint, onDeletePoints, onHideSegment, onRemoveCut, permissions } = stateRef.current;
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
          // Clear detected similar strips
          detectedSimilarStripsRef.current = null;
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

        case ' ':
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

        case "o":
          // Toggle H/V orientation for STRIP + smart and POLYLINE_CLICK + smart.
          if (
            enabledDrawingMode === "STRIP" ||
            enabledDrawingMode === "POLYLINE_CLICK"
          ) {
            dispatch(toggleStripDetectionOrientation());
          }
          break;

        case "a":
          // Toggle the unified smart-detect switch.
          if (showSmartDetectRef.current) {
            dispatch(toggleSmartDetectEnabled());
          }
          break;

        case "f":
          if (showSmartDetect) {
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
    else if (["MEASURE", "SEGMENT", "RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode)) {
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

      // A. DÉTECTION DU CLIC SUR UN POINT (VERTEX)
      // Les points auront data-node-type="VERTEX"
      const hitPoint = nativeTarget.closest?.('[data-node-type="VERTEX"]');

      if (hitPoint) {
        const { pointId, annotationId } = hitPoint.dataset;
        // Si l'annotation est déjà sélectionnée, on gère le shift+click
        if (selectedNode?.nodeId === annotationId) {
          if (event.shiftKey) {
            // Shift+click: toggle point in multi-selection
            console.log("Toggle Point Selection:", pointId);
            dispatch(toggleSelectedPointId(pointId));
            dispatch(setSubSelection({ pointId, partType: "VERTEX" }));
          }
          // Normal click selection + toggle type is handled by usePointDrag mouseUp
          return;
        }
      } else {
        // Si on clique ailleurs (sur le trait ou le vide), on déselectionne les points
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
    if (['CLICK', 'POLYLINE_CLICK', 'POLYGON_CLICK', 'CUT_CLICK', 'SPLIT_CLICK', 'STRIP', 'ONE_CLICK', "MEASURE", "RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE", "COMPLETE_ANNOTATION"].includes(enabledDrawingMode)) {
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

      else if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "MEASURE", "SEGMENT"].includes(enabledDrawingMode) && newPointsList?.length === 2) {
        commitPolyline(e); // add "e" to get clientX & clientY to set the measurePopper anchor position.
      }

      else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode) && newPointsList?.length === 3) {
        drawingPointsRef.current = newPointsList;
        commitPolyline(e);
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

    if (pointLassoRect) {
      endPointLasso();
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

    console.log("hit", hit?.dataset, e.shiftKey)

    if (e.shiftKey && !enabledDrawingModeRef.current) {
      const hasSelectedAnnotation = !!selectedNode?.nodeId;

      if (hasSelectedAnnotation) {
        // Point-level lasso: when an annotation is already selected
        // Skip if clicking on a vertex/snap helper (shift+click = multi-select point)
        // Skip if clicking on a DIFFERENT annotation (shift+click = multi-select annotation)
        const hitVertex = target.closest?.('[data-node-type="VERTEX"]');
        const hitSnapVertex = target.closest?.('[data-snap-type="VERTEX"]');
        const hitAnnotation = hit?.dataset?.nodeType === "ANNOTATION" ? hit?.dataset?.nodeId : null;
        const isClickOnOtherAnnotation = hitAnnotation && hitAnnotation !== selectedNode?.nodeId;
        if (!hitVertex && !hitSnapVertex && !isClickOnOtherAnnotation) {
          const started = startPointLasso(e);
          if (started) {
            console.log("point lasso started");
            e.stopPropagation();
            return;
          }
        }
      }
      // Annotation-level lasso: when clicking on empty space or base map
      else if (!hit || hit?.dataset?.nodeType === "BASE_MAP") {
        const started = startLasso(e);
        if (started) {
          console.log("lasso started")
          e.stopPropagation();
          return;
        }
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
      const { targetColor, versionId: dragVersionId } = calibrationHandle.dataset;
      initCalibrationDrag(targetColor, e, dragVersionId);
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
            crosshairAxis={
              smartDetectEnabled &&
              (enabledDrawingMode === "STRIP" || enabledDrawingMode === "POLYLINE_CLICK")
                ? stripDetectionOrientation
                : "BOTH"
            }
            showZoomRect={Boolean(enabledDrawingMode) && !NO_SMART_DETECT_MODES.includes(enabledDrawingMode)}
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
          <TransientDetectedStripsLayer ref={transientDetectedStripsRef} />
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
              orthoSnapAngleOffset={orthoSnapAngleOffset}
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