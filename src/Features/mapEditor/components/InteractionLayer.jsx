// components/InteractionLayer.jsx
import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useDispatch, useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';

import { useInteraction } from '../context/InteractionContext';

import { setEnabledDrawingMode } from 'Features/mapEditor/mapEditorSlice';
import { setSelectedNode } from 'Features/mapEditor/mapEditorSlice';
import { setAnnotationToolbarPosition } from 'Features/mapEditor/mapEditorSlice';
import { setOpenDialogDeleteSelectedAnnotation, setTempAnnotations } from 'Features/annotations/annotationsSlice';
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import useResetNewAnnotation from 'Features/annotations/hooks/useResetNewAnnotation';

import Box from '@mui/material/Box';
import MapEditorViewport from 'Features/mapEditorGeneric/components/MapEditorViewport';
import DrawingLayer from 'Features/mapEditorGeneric/components/DrawingLayer';
import BrushDrawingLayer from 'Features/mapEditorGeneric/components/BrushDrawingLayer';
import ScreenCursorV2 from 'Features/mapEditorGeneric/components/ScreenCursorV2';
import SnappingLayer from 'Features/mapEditorGeneric/components/SnappingLayer';
import TransientTopologyLayer from 'Features/mapEditorGeneric/components/TransientTopologyLayer';
import TransientAnnotationLayer from 'Features/mapEditorGeneric/components/TransientAnnotationLayer';

import TransientDetectedShapeLayer from 'Features/mapEditorGeneric/components/TransientDetectedShapeLayer';

import ClosingMarker from 'Features/mapEditorGeneric/components/ClosingMarker';
import HelperScale from 'Features/mapEditorGeneric/components/HelperScale';
import MapTooltip from 'Features/mapEditorGeneric/components/MapTooltip';
import SmartDetectLayer from 'Features/mapEditorGeneric/components/SmartDetectLayer';



import snapToAngle from 'Features/mapEditor/utils/snapToAngle';
import getBestSnap from 'Features/mapEditor/utils/getBestSnap';
import getAnnotationEditionPanelAnchor from 'Features/annotations/utils/getAnnotationEditionPanelAnchor';
import getAnnotationLabelPropsFromAnnotation from 'Features/annotations/utils/getAnnotationLabelPropsFromAnnotation';

import cv from "Features/opencv/services/opencvService";
import editor from "App/editor";
import getTopMiddlePoint from 'Features/geometry/utils/getTopMiddlePoint';
import { useSmartZoom } from "App/contexts/SmartZoomContext";

// constants

const SNAP_THRESHOLD_ABSOLUTE = 12;
const DRAG_THRESHOLD_PX = 3; // Seuil de déplacement pour activer le drag
const SCREEN_BRUSH_RADIUS_PX = 12; // Rayon fixe à l'écran
const LOUPE_SIZE = 200; // Taille écran de la loupe
const SMART_ZOOM = 3.0; // Facteur de grossissement
const MAX_FAILURES = 0; // On autorise 1 frames d'échec avant de stopper le autopan
const PAN_STEP = 30;

const InteractionLayer = forwardRef(({
  children,
  enabledDrawingMode,
  newAnnotation,
  onCommitDrawing,
  onCommitPointsFromDropFill,
  basePose,
  onBaseMapPoseChange,
  onBaseMapPoseCommit,
  baseMapImageSize,
  baseMapImageUrl,
  baseMapMainAngleInDeg,
  bgPose = { x: 0, y: 0, k: 1 },
  activeContext = "BASE_MAP",
  annotations, // <= snapping source.
  onPointMoveCommit,
  onPointDuplicateAndMoveCommit,
  onDeletePoint,
  onHideSegment,
  onRemoveCut,
  onAnnotationMoveCommit,
  onSegmentSplit,
  snappingEnabled = true,
  selectedNode,
  baseMapMeterByPx,
  showBgImage,
  legendFormat,
  onLegendFormatChange,
}
  , ref) => {
  const dispatch = useDispatch();



  // refs

  const viewportRef = useRef(null); // Ref vers la caméra
  const drawingLayerRef = useRef(null);
  const brushLayerRef = useRef(null);
  const screenCursorRef = useRef(null);
  const snappingLayerRef = useRef(null);
  const closingMarkerRef = useRef(null);
  const helperScaleRef = useRef(null);
  const baseMapRafRef = useRef(null); // Raf = requestAnimationFrame, pour contrôle du resize de la map.
  const smartDetectRef = useRef(null); // <--- REF VERS LA LOUPE
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


  // context

  const { setHoveredNode,
    setHiddenAnnotationIds,
    setDraggingAnnotationId,
    setSelectedPointId, selectedPointId,
    setSelectedPartId, selectedPartId,
    setBasePose } = useInteraction();

  const { zoomContainer } = useSmartZoom();

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

  const selectedAnnotation = useMemo(() => {
    if (selectedNode?.nodeId?.startsWith("label::")) {
      const annotationId = selectedNode?.nodeId.replace("label::", "");
      return getAnnotationLabelPropsFromAnnotation(annotations?.find((annotation) => annotation.id === annotationId));
    } else {
      return annotations?.find((annotation) => annotation.id === selectedNode?.nodeId);
    }
  }, [annotations, selectedNode?.nodeId]);

  // annotations for Snap

  let annotationsForSnap = annotations;
  if (selectedAnnotation) annotationsForSnap = [selectedAnnotation];

  // cameraZoom

  const cameraZoom = viewportRef.current?.getZoom() || 1;

  // Transient detected line

  // Transient detected line
  const previewLineLayerRef = useRef(null);
  const transientDetectedCornerLayerRef = useRef(null);
  const transientDetectedShapeLayerRef = useRef(null);
  const smartCornerRef = useRef(null);
  const detectedShapeRef = useRef(null);


  const handleSmartShapeDetected = (shape) => {
    // shape: { type: 'POINT'|'LINE'|'RECTANGLE', points: [] } ou null
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


  // Reset selectedPointId quand on change de noeud sélectionné
  useEffect(() => {
    setSelectedPointId(null);
  }, [selectedNode?.nodeId]);


  // updateSmartDetect

  const [showSmartDetect, setShowSmartDetect] = useState(false);
  const showSmartDetectRef = useRef(showSmartDetect);
  useEffect(() => {
    const show = Boolean(enabledDrawingMode)
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
      x: localPos.x - sourceWidthInImage / 2,
      y: localPos.y - sourceHeightInImage / 2,
      width: sourceWidthInImage,
      height: sourceHeightInImage
    };

    // B. VISUEL : Positionner la loupe avec les coordonnées LOCALES (viewportPos)
    // car le composant SmartDetectLayer est rendu en 'absolute' dans cette Box
    if (smartDetectRef.current) {
      smartDetectRef.current.update(viewportPos, sourceROI);
    }

    lastSmartROI.current = { ...sourceROI, zoomFactor: SMART_ZOOM, totalScale };
  }, [toLocalCoords, getTargetPose]);


  // drag state

  const [dragState, setDragState] = useState(null);
  const dragStateRef = useRef(dragState);

  // Structure: { active: boolean, pointId: string, currentPos: {x,y} }

  const [dragAnnotationState, setDragAnnotationState] = useState(null);
  const dragAnnotationStateRef = useRef(dragAnnotationState);
  // Structure: { 
  //   active: boolean, 
  //   pending: boolean, // <--- Nouveau flag
  //   annotationId: string, 
  //   currentPos: {x,y}, 
  //   startMouseScreen: {x,y} // <--- Pour calculer le seuil
  // }

  // State pour le drag de la BaseMap
  const [dragBaseMapState, setDragBaseMapState] = useState(null);
  // { active: true, handleType: 'MOVE'|'SE'..., startMouseScreen: {x,y}, startBasePose: {x,y,k} }

  const [dragLegendState, setDragLegendState] = useState(null);
  // { active: true, handleType: 'MOVE'|'SE'..., startMouseScreen: {x,y}, startFormat }

  const [dragTextState, setDragTextState] = useState(null);
  // { active: true, handleType: 'MOVE'|'SE'..., startMouseScreen: {x,y}, startText }

  const currentSnapRef = useRef(null); // Stocke le résultat du getBestSnap

  // drawing points

  const [drawingPoints, setDrawingPoints] = useState([]);
  const drawingPointsRef = useRef([]);
  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);


  // cutHostId

  const [cutHostId, setCutHostId] = useState(null);
  const cutHostIdRef = useRef(null);
  useEffect(() => {
    cutHostIdRef.current = cutHostId;
  }, [cutHostId]);


  // brush path

  const [brushPath, setBrushPath] = useState([]);
  const brushPathRef = useRef([]); // Ref pour accès synchrone rapide (perf) et éviter stale closures
  useEffect(() => {
    brushPathRef.current = brushPath;
  }, [brushPath]);


  // virtual insertion

  const [virtualInsertion, setVirtualInsertion] = useState(null);

  // is closing
  const isClosingRef = useRef(false);

  const handleHoverFirstPoint = (pointCoordinates) => {
    isClosingRef.current = true;

    // Optionnel : Afficher le ClosingMarker visuel (le rond vert)
    // On doit convertir les coords locales du point en écran pour l'overlay
    const pose = getTargetPose();
    const worldX = pointCoordinates.x * pose.k + pose.x;
    const worldY = pointCoordinates.y * pose.k + pose.y;

    //const screenPos = viewportRef.current?.worldToViewport(pointCoordinates.x, pointCoordinates.y);
    const screenPos = viewportRef.current?.worldToViewport(worldX, worldY);

    if (screenPos) {
      closingMarkerRef.current?.update(screenPos);
    }

    // Magnétiser le trait de dessin sur le premier point
    drawingLayerRef.current?.updatePreview(pointCoordinates);
  };

  const handleLeaveFirstPoint = () => {
    isClosingRef.current = false;
    closingMarkerRef.current?.update(null);
  };


  // syncRef

  const enabledDrawingModeRef = useRef(enabledDrawingMode);
  useEffect(() => {
    enabledDrawingModeRef.current = enabledDrawingMode;
  }, [enabledDrawingMode]);

  const onCommitDrawingRef = useRef(onCommitDrawing);
  useEffect(() => {
    onCommitDrawingRef.current = onCommitDrawing;
  }, [onCommitDrawing]);

  const stateRef = useRef({
    selectedNode,
    selectedPointId,
    selectedPartId,
    enabledDrawingMode: enabledDrawingMode, // Si besoin dans le listener
    onDeletePoint,
    onHideSegment,
    onRemoveCut,
    onPointDuplicateAndMoveCommit,
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
      onPointDuplicateAndMoveCommit
    };
  }, [selectedNode, selectedPointId, selectedPartId, onDeletePoint, onHideSegment, onRemoveCut, enabledDrawingMode, onPointDuplicateAndMoveCommit]);


  // 1. Calculer le style curseur du conteneur
  const getCursorStyle = () => {
    if (dragState?.active) return 'crosshair';
    if (enabledDrawingMode) return 'crosshair'; // Priorité 1           // Priorité 2
    return 'default';                           // Défaut
  };

  // --- LOGIQUE DE COMMIT (Sauvegarde) ---
  const commitPoint = () => {
    const pointsToSave = drawingPointsRef.current; // On lit la Ref, pas le State !
    if (pointsToSave.length === 1) {
      console.log("COMMIT POINT", pointsToSave);
      onCommitDrawingRef.current({ points: pointsToSave });
    } else {
      console.log("⚠️ erreur création d'un point.");
    }

    // Nettoyage
    setDrawingPoints([]);
    //dispatch(setEnabledDrawingMode(null));
  };


  const commitPolyline = async (event, options) => {
    const drawingMode = enabledDrawingModeRef.current;


    // --- CAS BRUSH ---
    if (drawingMode === "BRUSH") {
      if (brushPathRef.current.length === 0) return;

      console.log("Processing Brush Drawing...");

      // 1. Snapshot du Canvas
      const dataUrl = brushLayerRef.current?.getSnapshotDataUrl();
      if (!dataUrl) return;

      // 2. Appel OpenCV
      await cv.load();
      const polygons = await cv.extractPolygonsFromMaskAsync({
        maskDataUrl: dataUrl,
        simplificationFactor: 3.0
      }); // Facteur 3.0 pour lisser

      // 3. Commit pour chaque polygone trouvé
      console.log("[BRUSH] Polygons found:", polygons);
      if (polygons && polygons.length > 0) {
        polygons.forEach(points => {
          if (onCommitDrawingRef.current) onCommitDrawingRef.current({ points, options });
        });
      }

      // 4. Reset
      setBrushPath([]);
      //dispatch(setEnabledDrawingMode(null));
      return;
    }

    // --- CAS SMART_DETECT ---
    if (drawingMode === "SMART_DETECT") {
      const localPolylines = smartDetectRef.current?.getDetectedPolylines();
      const roiData = lastSmartROI.current; // On récupère ce qu'on a stocké


      console.log("[SMART_DETECT] Local Polylines:", localPolylines);
      if (localPolylines && roiData) {
        const ratio = roiData.width / LOUPE_SIZE;

        localPolylines.forEach(localPolyline => {
          const points = localPolyline.points.map(p => ({
            x: roiData.x + (p.x * ratio),
            y: roiData.y + (p.y * ratio)
          }));
          if (onCommitDrawingRef.current) onCommitDrawingRef.current({ points });
        });

      }
      return;

    }


    // --- CAS CLICK/POLYLINE (Défaut) ---

    const pointsToSave = drawingPointsRef.current; // On lit la Ref, pas le State ! 
    const _cutHostId = cutHostIdRef.current;
    if (pointsToSave.length >= 2) {

      onCommitDrawingRef.current({ points: pointsToSave, event, cutHostId: _cutHostId });

      // EXEMPLE D'ACTION :
      // onNewAnnotation({ type: 'POLYLINE', points: pointsToSave });
      // ou dispatch(createPolyline(pointsToSave));
    } else {
      console.log("⚠️ Pas assez de points pour créer une polyligne");
    }

    // Nettoyage
    setDrawingPoints([]);
    setCutHostId(null);
    //dispatch(setEnabledDrawingMode(null));
  };



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
      const { selectedNode, selectedPointId, selectedPartId, onDeletePoint, onHideSegment, onRemoveCut } = stateRef.current;
      const showSmartDetect = showSmartDetectRef.current;
      const enabledDrawingMode = enabledDrawingModeRef.current;

      if (e.repeat) return;

      switch (e.key) {
        // 1. ESCAPE : Reset Selection
        case 'Escape':
          console.log("Action: Reset Selection & Tool");
          if (selectedPartId) {
            setSelectedPartId(null);
            e.stopPropagation();
            return;
          }

          if (selectedPointId && selectedNode?.nodeId) {
            console.log("Action: Deselect Point");
            setSelectedPointId(null);
            e.stopPropagation(); // Empêcher le resetNewAnnotation
            return;
          }

          setSelectedPointId(null);
          resetNewAnnotation();
          dispatch(setEnabledDrawingMode(null));
          dispatch(setSelectedNode(null));
          dispatch(setTempAnnotations([]));

          setHiddenAnnotationIds([]);
          setDrawingPoints([]);
          setBrushPath([]);
          setCutHostId(null);

          setShowSmartDetect(false);

          if (transientDetectedShapeLayerRef.current) {
            transientDetectedShapeLayerRef.current.updateShape(null);
          }
          break;

        case 'd':

          const mousePos = lastMouseScreenPosRef.current;
          setShowSmartDetect(true);
          console.log("press d", mousePos)
          updateSmartDetect(mousePos);
          break;

        case ' ':
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

              else if (enabledDrawingMode === "RECTANGLE" && newPoints.length === 2) {
                commitPolyline();
              }


              console.log("Space pressed: Smart Point added", point);
            }

            // B. LINE / RECTANGLE (Multiple points)
            else if (['LINE', 'RECTANGLE', 'POLYLINE'].includes(shape.type) && shape.points && shape.points.length > 0) {
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

        case "m":
          console.log("press m")
          if (showSmartDetect) smartDetectRef.current?.changeMorphKernelSize(-1);
          break;

        case "Enter":
          if (enabledDrawingModeRef.current === "CLICK" || enabledDrawingModeRef.current === "BRUSH") {
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
          console.log("Action: Delete Selected");
          // 1. Si un point est sélectionné, on le supprime
          if (selectedPointId && onDeletePoint) {
            console.log("Action: Delete Point", selectedPointId, selectedNode?.nodeId);
            // On passe l'ID du point et l'ID de l'annotation parente
            onDeletePoint({ pointId: selectedPointId, annotationId: selectedNode?.nodeId });
            setSelectedPointId(null); // Reset selection
            e.stopPropagation();
            return;
          }
          else if (selectedPartId && selectedNode?.nodeId) {
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

            // B. Suppression de CUT (Trou) -> [NOUVEAU]
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

          const panByXMap = {
            "ArrowRight": -50,
            "ArrowLeft": 50,
            "ArrowUp": 0,
            "ArrowDown": 0
          }
          const panByYMap = {
            "ArrowRight": 0,
            "ArrowLeft": 0,
            "ArrowUp": 50,
            "ArrowDown": -50
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
        if (annotationType === "POLYGON" && !cutHostId) {
          console.log("[InteractionLayer] CUT HOST ID", nodeId)
          setCutHostId(nodeId)
        }
      }
    }

    if (enabledDrawingMode === 'CLICK') {
      // Apply snapping if Shift is pressed
      let finalPos = toLocalCoords(worldPos);
      if ((event.shiftKey || event.evt?.shiftKey) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        finalPos = snapToAngle(finalPos, lastPoint);
      }

      // 1. Ajouter le point (Déclenche un re-render de DrawingLayer pour la partie statique)
      setDrawingPoints(prev => [...prev, finalPos]);

      // 2. Si on a fini (ex: double clic ou fermeture), on commit
      // if (isClosing) { saveToDb(drawingPoints); setDrawingPoints([]); }
    }

    // --- CASE 2: ONE_CLICK (Auto-commit after 1 point) ---
    else if (enabledDrawingMode === 'ONE_CLICK') {
      // Apply snapping if Shift is pressed
      let finalPos = toLocalCoords(worldPos);
      if ((event.shiftKey || event.evt?.shiftKey) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        finalPos = snapToAngle(finalPos, lastPoint);
      }

      // 1. Ajouter le point (Déclenche un re-render de DrawingLayer pour la partie statique)
      setDrawingPoints(prev => [...prev, finalPos]);
      drawingPointsRef.current = [finalPos];
      commitPoint();
    }

    // --- CASE 3: MEASURE / SEGMENT (Auto-commit after 2 points) ---
    else if (["MEASURE", "SEGMENT", "RECTANGLE"].includes(enabledDrawingMode)) {
      let finalPos = toLocalCoords(worldPos);

      // Apply Angle Snap (Ortho) if Shift is held and it's the 2nd point
      if ((event.shiftKey || event.evt?.shiftKey) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        finalPos = snapToAngle(finalPos, lastPoint);
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
      }
    }

    // -- CASE 4: DROP_FIIL
    else if (enabledDrawingMode === "DROP_FILL") {
      await cv.load();
      let finalPos = toLocalCoords(worldPos);
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
          x: viewportBounds.x,
          y: viewportBounds.y,
          width: Math.max(1, viewportBounds.width),
          height: Math.max(1, viewportBounds.height),
        };
      }

      const { points, cuts } = await cv.detectContoursAsync({
        imageUrl: baseMapImageUrl,
        x: finalPos.x,
        y: finalPos.y,
        viewportBBox,
      });

      const topMiddlePoint = getTopMiddlePoint(points);
      const pose = getTargetPose(); // getTargetPose retourne basePose par défaut
      const worldX = topMiddlePoint.x * pose.k + pose.x;
      const worldY = topMiddlePoint.y * pose.k + pose.y;
      const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);
      if (onCommitPointsFromDropFill) {
        onCommitPointsFromDropFill({ points, cuts, screenPos });
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
        // Si l'annotation est déjà sélectionnée, on sélectionne le point
        if (selectedNode?.nodeId === annotationId) {
          console.log("Select Point:", pointId);
          setSelectedPointId(pointId);
          // On arrête ici pour ne pas relancer la sélection de noeud
          return;
        }
      } else {
        // Si on clique ailleurs (sur le trait ou le vide), on déselectionne le point
        if (selectedPointId) setSelectedPointId(null);
      }

      // 2. Ensuite les Parts (Segments / Contours)
      // On cherche un élément avec data-part-id
      const hitPart = nativeTarget.closest?.('[data-part-id]');

      if (hitPart) {
        const partId = hitPart.dataset.partId;
        const nodeId = hitPart.dataset.nodeId;
        const isParentSelected = selectedNode?.nodeId === nodeId;

        if (isParentSelected) {
          console.log("Selecting Part:", partId);
          setSelectedPartId(prev => prev === partId ? null : partId);
          return;
        }
      }


      const hit = nativeTarget.closest?.("[data-node-type]");
      if (hit) {
        console.log("[InteractionLayer] selected node", hit?.dataset)
        if (
          !showBgImage && hit?.dataset?.nodeType === "BASE_MAP"
          || showBgImage && hit?.dataset?.nodeType === "BG_IMAGE"

        ) {
          dispatch(setSelectedNode(null))
          setHiddenAnnotationIds([]);
          dispatch(setAnnotationToolbarPosition(null));
        }

        // --- 2. GESTION DES ANNOTATIONS ---
        else if (
          hit?.dataset?.nodeType === "ANNOTATION" && !showBgImage
          || hit?.dataset?.nodeContext === "BG_IMAGE"
        ) {
          const annotation = annotations.find((a) => a.id === hit?.dataset.nodeId);
          const topMiddlePoint = getAnnotationEditionPanelAnchor(annotation);



          // --- 2.1. GESTION DES ANNOTATIONS ---
          dispatch(setSelectedNode(hit?.dataset));
          //setHiddenAnnotationIds([hit?.dataset.nodeId]); hidden : juste pour le drag

          // -- Afichage du toolbar pour édition --
          if (topMiddlePoint) {
            // 2. Convertir LOCAL -> MONDE
            // Il faut savoir dans quel contexte est l'annotation
            const isBgContext = hit?.dataset?.nodeContext === "BG_IMAGE";
            const pose = isBgContext ? bgPose : getTargetPose(); // getTargetPose retourne basePose par défaut

            const worldX = topMiddlePoint.x * pose.k + pose.x;
            const worldY = topMiddlePoint.y * pose.k + pose.y;

            // 3. Convertir MONDE -> ÉCRAN (Viewport)
            // On utilise la ref du viewport
            const screenPos = viewportRef.current?.worldToScreen(worldX, worldY);
            dispatch(
              setAnnotationToolbarPosition({ x: screenPos?.x, y: screenPos?.y })
            );
          }

          if (tooltipData) setTooltipData(null);
        } else if (showBgImage && hit?.dataset?.nodeType !== "ANNOTATION") {
          dispatch(setSelectedNode(hit?.dataset));
          setHiddenAnnotationIds([hit?.dataset.nodeId]);
        }

      } else {
        dispatch(setSelectedNode(null));
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

    // --- 1. DÉTECTION DE L'ÉTAT D'INTERACTION ---
    // Est-ce qu'une action prioritaire est en cours ?
    const isInteracting =
      isPanning ||
      dragState?.active ||
      dragAnnotationState?.active ||
      dragBaseMapState?.active ||
      dragLegendState?.active ||
      dragTextState?.active ||
      enabledDrawingMode ||
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

    // A. DRAG POINT (Vertex)

    if (dragState?.pending) {
      // 1. Calcul de la distance parcourue
      const dx = event.clientX - dragState.startMouseScreen.x;
      const dy = event.clientY - dragState.startMouseScreen.y;
      const dist = Math.hypot(dx, dy);

      // 2. Si on dépasse le seuil, on ACTIVE le drag
      if (dist > DRAG_THRESHOLD_PX) {

        let finalPointId = dragState.pointId;
        let finalIsDuplicateMode = false;
        let idsToHide = dragState.affectedIds;

        if (dragState.potentialDuplicate) {
          // C'EST MAINTENANT QU'ON CRÉE LE CLONE
          finalIsDuplicateMode = true;
          finalPointId = `temp_dup_${nanoid()}`; // ID Temporaire pour le visuel

          // En mode dupliqué, on ne cache QUE l'annotation sélectionnée
          // (Les voisins restent visibles car ils ne bougent pas encore)
          if (selectedNode?.nodeId) {
            idsToHide = [selectedNode.nodeId];
          }
        }

        // On active le drag
        const newDragState = {
          ...dragState,
          pending: false,
          active: true,
          isDuplicateMode: finalIsDuplicateMode,
          pointId: finalPointId, // Peut être l'ID temp maintenant
          affectedIds: idsToHide
        }
        setDragState(newDragState);
        dragStateRef.current = newDragState;

        // On cache l'annotation réelle maintenant (et pas au clic)
        setHiddenAnnotationIds(idsToHide);
      } else {
        // Tant qu'on n'a pas bougé assez, on ne fait rien (on absorbe l'événement)
        return;
      }
    }

    if (dragState?.active) {
      snappingLayerRef.current?.update(null);
      const localPos = toLocalCoords(worldPos);

      const newDragState = { ...dragState, currentPos: localPos }
      setDragState(newDragState);
      dragStateRef.current = newDragState;
      return; // Action exclusive, on arrête ici
    }

    // B1. DRAG BASEMAP (Image de fond)
    if (dragBaseMapState?.active) {
      const { startMouseWorld, startBasePose, handleType } = dragBaseMapState;

      // Calcul du Delta en UNITÉS MONDE
      const dxWorld = worldPos.x - startMouseWorld.x;
      const dyWorld = worldPos.y - startMouseWorld.y;

      let newBasePoseWorld = { ...startBasePose };

      // Cas 1 : Déplacement
      if (handleType === 'MOVE') {
        newBasePoseWorld.x += dxWorld;
        newBasePoseWorld.y += dyWorld;
      }
      // Cas 2 : Redimensionnement
      else if (['SE', 'SW', 'NE', 'NW'].includes(handleType)) {
        if (baseMapImageSize?.width && baseMapImageSize?.height) {
          const w = baseMapImageSize.width;
          const h = baseMapImageSize.height;

          // Calcul du changement d'échelle (Delta K)
          let deltaK = 0;
          if (handleType.includes('E')) {
            deltaK = dxWorld / w;
          } else {
            deltaK = -dxWorld / w;
          }

          const newK = Math.max(0.001, startBasePose.k + deltaK);
          newBasePoseWorld.k = newK;

          // Compensation de la position pour les coins Ouest/Nord
          const kDiff = newK - startBasePose.k;
          const widthChange = w * kDiff;
          const heightChange = h * kDiff;

          if (handleType.includes('W')) {
            newBasePoseWorld.x = startBasePose.x - widthChange;
          }
          if (handleType.includes('N')) {
            newBasePoseWorld.y = startBasePose.y - heightChange;
          }
        }
      }

      // Rétro-projection vers le référentiel du BG
      const bgK = bgPose?.k || 1;
      const bgX = bgPose?.x || 0;
      const bgY = bgPose?.y || 0;

      const newPoseInBg = {
        x: (newBasePoseWorld.x - bgX) / bgK,
        y: (newBasePoseWorld.y - bgY) / bgK,
        k: newBasePoseWorld.k / bgK,
        r: newBasePoseWorld.r
      };

      if (onBaseMapPoseChange) {
        // 1. Si une mise à jour est déjà prévue pour la prochaine frame, on l'annule
        // (car on a une donnée plus fraîche maintenant)
        if (baseMapRafRef.current) {
          cancelAnimationFrame(baseMapRafRef.current);
        }

        // 2. On planifie la mise à jour pour le prochain rafraîchissement écran
        baseMapRafRef.current = requestAnimationFrame(() => {
          onBaseMapPoseChange(newPoseInBg);
          baseMapRafRef.current = null; // Nettoyage
        });
      }
      return; // Action exclusive
    }

    // B2. DRAG LEGEND (Légende)
    if (dragLegendState?.active) {
      const { startMouseWorld, startFormat, handleType } = dragLegendState;

      // Conversion delta écran -> delta local BG
      // (Assumant que la légende est dans le BG, donc affectée par bgPose)
      const dxWorld = worldPos.x - startMouseWorld.x;
      const dyWorld = worldPos.y - startMouseWorld.y;

      const dxLocal = dxWorld / bgPose.k;
      const dyLocal = dyWorld / bgPose.k;

      let newX = startFormat.x;
      let newY = startFormat.y;
      let newWidth = startFormat.width;

      // --- GESTION POSITION (Move) ---
      if (handleType === 'MOVE') {
        newX += dxLocal;
        newY += dyLocal;
      }
      // --- GESTION LARGEUR (Principale) ---
      else if (handleType.includes('E')) {
        newWidth = Math.max(50, startFormat.width + dxLocal);
      }
      else if (handleType.includes('W')) {
        const possibleWidth = startFormat.width - dxLocal;
        if (possibleWidth > 50) {
          newWidth = possibleWidth;
          newX = startFormat.x + dxLocal;
        }
      }



      // Note: On ignore généralement le resize hauteur pour du texte fluide
      // car cela créerait un décalage entre la souris et le bord si le texte
      // ne remplit pas exactement la nouvelle hauteur.

      if (onLegendFormatChange) onLegendFormatChange({ x: newX, y: newY, width: newWidth });
      return;
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

    // C. DRAG ANNOTATION (Objet entier)
    // --- GESTION DU THRESHOLD 3PX ICI ---
    if (dragAnnotationState?.pending) {
      // Calcul de la distance parcourue depuis le clic initial
      const dx = event.clientX - dragAnnotationState.startMouseScreen.x;
      const dy = event.clientY - dragAnnotationState.startMouseScreen.y;
      const dist = Math.hypot(dx, dy);

      // Si on dépasse le seuil, on ACTIVE le drag
      if (dist > DRAG_THRESHOLD_PX) {

        const newDragAnnotationState = {
          ...dragAnnotationState,
          pending: false,
          active: true
        };

        setDragAnnotationState(newDragAnnotationState);
        dragAnnotationStateRef.current = newDragAnnotationState;

        setDraggingAnnotationId(dragAnnotationState.selectedAnnotationId);
      } else {
        // Sinon, on ne fait rien (on absorbe le mouvement sans déplacer l'objet)
        return;
      }
    }

    if (dragAnnotationState?.active) {
      const currentMouseInWorld = viewportRef.current?.screenToWorld(event.clientX, event.clientY);
      const currentMouseInLocal = toLocalCoords(currentMouseInWorld);
      const deltaPos = {
        x: currentMouseInLocal.x - dragAnnotationState.startMouseInLocal.x,
        y: currentMouseInLocal.y - dragAnnotationState.startMouseInLocal.y
      };
      const newDragAnnotationState = { ...dragAnnotationState, deltaPos, localPos: currentMouseInLocal };
      setDragAnnotationState(newDragAnnotationState);
      dragAnnotationStateRef.current = newDragAnnotationState;
      return; // Action exclusive
    }

    // D. SNAPPING
    // Correction : On autorise le snapping pendant le dessin (enabledDrawingMode)
    // On l'interdit seulement pour le Pan ou le Drag d'objets lourds
    const preventSnapping = isPanning || dragAnnotationState?.active || dragBaseMapState?.active;

    let snapResult;
    if (snappingEnabled && !preventSnapping) {
      const imageScale = getTargetScale();
      const currentCameraZoom = viewportRef.current?.getZoom() || 1;
      const scale = imageScale * currentCameraZoom;
      const localPos = toLocalCoords(worldPos);
      const snapThreshold = SNAP_THRESHOLD_ABSOLUTE / scale;

      snapResult = getBestSnap(localPos, annotationsForSnap, snapThreshold, true);

      if (snapResult) {
        currentSnapRef.current = snapResult;
        const pose = getTargetPose();
        const worldSnapX = snapResult.x * pose.k + pose.x;
        const worldSnapY = snapResult.y * pose.k + pose.y;
        const screenSnap = viewportRef.current?.worldToViewport(worldSnapX, worldSnapY);

        if (screenSnap) {
          snappingLayerRef.current?.update({ ...screenSnap, type: snapResult.type });
        }
      } else {
        snappingLayerRef.current?.update(null);
      }
    } else {
      // Nettoyage si on ne snap pas
      snappingLayerRef.current?.update(null);
    }

    // E. DRAWING PREVIEW
    if (['CLICK', 'ONE_CLICK', "MEASURE", "RECTANGLE"].includes(enabledDrawingMode)) {
      const localPos = toLocalCoords(worldPos);
      let previewPos = localPos;

      // Angle snap drawing
      if ((event.shiftKey || event.evt?.shiftKey) && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        previewPos = snapToAngle(localPos, lastPoint);
      }
      drawingLayerRef.current?.updatePreview(previewPos);
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

      else if (enabledDrawingMode === "RECTANGLE" && newPointsList?.length === 2) {
        commitPolyline();
      }

      // On s'arrête ici
      return;
    }
    // =======================================================

    // --- CAS 1 : EXISTING VERTEX ---
    if (snap.type === 'VERTEX') {
      const pointId = snap.id;

      // 1. Détecter si on est sur une annotation sélectionnée
      // (On vérifie si l'annotation sélectionnée contient ce point)
      const selectedAnnotationHasPoint = selectedNode &&
        annotations.find(a => a.id === selectedNode.nodeId)?.points.some(p => p.id === pointId);

      // 2. On note juste que c'est une POTENTIELLE duplication
      const isPotentialDuplicate = !!selectedAnnotationHasPoint;

      // 3. Calcul des IDs affectés (Standard pour l'instant)
      const affectedIds = annotations
        .filter(ann => {
          const inMain = ann.points?.some(pt => pt.id === pointId);
          const inCuts = ann.cuts?.some(cut => cut.points?.some(pt => pt.id === pointId));
          return inMain || inCuts;
        })
        .map(ann => ann.id);

      const newDragState = {
        active: false,
        pending: true,

        pointId: pointId, // <--- ON GARDE L'ID RÉEL (Important pour le click/select)
        originalPointId: pointId, // On garde une copie au cas où

        isDuplicateMode: false, // <--- PAS ENCORE TRUE
        potentialDuplicate: isPotentialDuplicate, // <--- NOUVEAU FLAG

        currentPos: { x: snap.x, y: snap.y },
        startMouseScreen: { x: e.clientX, y: e.clientY },
        affectedIds: affectedIds
      }

      setDragState(newDragState);
      dragStateRef.current = newDragState;

      setVirtualInsertion(null);
    }

    // --- CAS 2 : PROJECTION (Nouveau Point) ---
    else if (snap.type === 'PROJECTION') {
      // 1. Générer un ID temporaire pour l'UI
      const tempId = `temp_${nanoid()}`;

      // 2. Configurer le drag state

      const newDragState = {
        active: true,
        pointId: tempId,
        currentPos: { x: snap.x, y: snap.y }
      }
      setDragState(newDragState);
      dragStateRef.current = newDragState;

      // 3. Configurer l'insertion virtuelle
      // getBestSnap doit retourner annotationId et segmentIndex !
      setVirtualInsertion({
        // Pour le visuel immédiat (on en montre qu'un seul qui bouge pour pas alourdir le DOM)
        annotationId: snap.previewAnnotationId,
        segmentIndex: snap.previewSegmentIndex,
        cutIndex: snap.cutIndex,

        // Pour la logique finale
        segmentStartId: snap.segmentStartId,
        segmentEndId: snap.segmentEndId
      });

      // 4. Cacher l'annotation parente (pour ne pas voir le trait droit en dessous)
      setHiddenAnnotationIds([snap.previewAnnotationId]);
    }

    //snappingLayerRef.current?.update(null); // hide snapping circle // on hide au move

    // FORCE CURSOR ON BODY
    document.body.style.cursor = 'crosshair';
  };


  // --- 3. MOUSE UP (Global) ---
  const handleMouseUp = () => {


    const { onPointDuplicateAndMoveCommit } = stateRef.current;
    const dragState = dragStateRef.current;
    const dragAnnotationState = dragAnnotationStateRef.current;

    console.log('handleMouseUp_dragAnnotationState', dragAnnotationState);

    // click sur un vertex
    if (!dragAnnotationState?.active && dragAnnotationState?.pending) {
      const annotationId = dragAnnotationState.selectedAnnotationId;
      if (annotationId) {
        dispatch(setSelectedNode({
          nodeId: dragAnnotationState.selectedAnnotationId,
          nodeType: 'ANNOTATION'
        }));
      }
      setDragAnnotationState(null);
      dragAnnotationStateRef.current = null;

    }

    // ... (Gestion BaseMap drag & Legend inchangée) ...
    if (dragBaseMapState?.active) {
      if (onBaseMapPoseCommit) onBaseMapPoseCommit();
      setDragBaseMapState(null);
      document.body.style.cursor = '';
    }

    if (dragLegendState?.active) {
      setDragLegendState(null);
      document.body.style.cursor = '';
    }

    // --- CORRECTION ICI ---
    // On vérifie simplement si dragState existe, peu importe s'il est pending ou active
    if (dragState) {

      // CAS A : C'était un DRAG (active = true, pending = false)
      if (dragState.active) {

        // 1. Commit des données
        if (virtualInsertion && onSegmentSplit) {
          onSegmentSplit({
            segmentStartId: virtualInsertion.segmentStartId,
            segmentEndId: virtualInsertion.segmentEndId,
            x: dragState.currentPos.x,
            y: dragState.currentPos.y
          });
        }

        else if (dragState.isDuplicateMode && onPointDuplicateAndMoveCommit) {
          onPointDuplicateAndMoveCommit({
            originalPointId: dragState.originalPointId, // L'ID réel du point source
            annotationId: dragState.affectedIds[0],     // L'annotation qu'on éditait
            newPos: dragState.currentPos
          });
        }
        // 3. Commit Move Standard
        else if (onPointMoveCommit) {
          onPointMoveCommit(dragState.pointId, dragState.currentPos);
        }



        // 2. Gestion de l'anti-clignotement (Freeze)
        const newDragState = { ...dragState, active: false, frozen: true };
        dragStateRef.current = newDragState;
        setDragState(newDragState);

        // 3. Nettoyage différé
        setTimeout(() => {
          dragStateRef.current = null;
          setDragState(null);
          setHiddenAnnotationIds([]);
          setVirtualInsertion(null);
        }, 100);

        document.body.style.cursor = '';
      }

      // CAS B : C'était un CLICK (pending = true, active = false)
      else if (dragState.pending) {
        console.log("Point Clicked:", dragState.pointId);


        // Ici, dragState.pointId est TOUJOURS l'ID réel
        // (car on n'a pas déclenché la logique du MouseMove)
        setSelectedPointId(dragState.pointId);

        // Cleanup immédiat
        setDragState(null);
        dragStateRef.current = null;
        setVirtualInsertion(null);
        setHiddenAnnotationIds([]);
      }
    }

    // --- Gestion du Drag d'Annotation entière (inchangé) ---
    else if (dragAnnotationState) {
      if (dragAnnotationState.active) {
        if (onAnnotationMoveCommit) {
          onAnnotationMoveCommit(
            dragAnnotationState.selectedAnnotationId,
            dragAnnotationState.deltaPos,
            dragAnnotationState.partType,
            dragAnnotationState.localPos
          );
        }
      }
      setDragAnnotationState(null);
      dragAnnotationStateRef.current = null;
      setTimeout(() => setDraggingAnnotationId(null), 30);
      document.body.style.cursor = '';
    }
  };

  // --- HANDLER DU CLIC SUR LE CLOSING MARKER ---
  const handleClosingClick = () => {
    console.log("Closing Polygon via Marker Click");
    commitPolyline(); // Votre fonction existante qui ferme et sauvegarde
  };

  const handleMouseDownCapture = (e) => {
    if (!selectedNode) return;

    // ==================
    // Annotation
    // ==================

    const target = e.nativeEvent?.target || e.target;


    // --- permet la modif de l'input/textarea d'un label

    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
      return;
    }

    const draggableGroup = target.closest('[data-interaction="draggable"]');
    const partNode = target.closest('[data-part-type]');
    const partType = partNode?.dataset?.partType;

    const resizeHandle = target.closest('[data-interaction="resize-annotation"]');
    const basemapHandle = target.closest('[data-interaction="transform-basemap"]');
    const legendHandle = target.closest('[data-interaction="transform-legend"]');
    const textHandle = target.closest('[data-interaction="transform-text"]');

    if (resizeHandle) {
      e.stopPropagation();
      e.preventDefault();

      const { nodeId, handleType } = resizeHandle.dataset; // handleType = NW, SE...

      const worldPos = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
      const startMouseInLocal = toLocalCoords(worldPos);

      const newDragAnnotationState = {
        active: false,
        pending: true,
        selectedAnnotationId: nodeId,
        startMouseInLocal,
        partType: `RESIZE_${handleType}`, // ex: RESIZE_SE
        startMouseScreen: { x: e.clientX, y: e.clientY }
      };

      setDragAnnotationState(newDragAnnotationState);
      dragAnnotationStateRef.current = newDragAnnotationState;
      return;
    }

    if (draggableGroup) {

      e.stopPropagation();
      e.preventDefault();

      console.log("[InteractionLayer] mouse down on node", draggableGroup?.dataset)
      const { nodeId } = draggableGroup.dataset;

      const worldPos = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
      const startMouseInLocal = toLocalCoords(worldPos);

      // --- MODIFICATION ICI ---
      // On initialise en 'pending' (attente de mouvement)
      const newDragAnnotationState = {
        active: false, // Pas encore visuellement actif
        pending: true, // Nouveau flag
        selectedAnnotationId: nodeId,
        startMouseInLocal,
        partType,
        startMouseScreen: { x: e.clientX, y: e.clientY } // Stocker la position écran initiale
      };
      setDragAnnotationState(newDragAnnotationState);
      dragAnnotationStateRef.current = newDragAnnotationState;
      // On NE met PAS setDraggingAnnotationId tout de suite !
    }


    if (basemapHandle || legendHandle) {
      e.stopPropagation();
      e.preventDefault();

      const handleType = basemapHandle?.dataset?.handleType || legendHandle?.dataset?.handleType;

      // 1. CONVERSION ÉCRAN -> MONDE (Prend en compte la CameraMatrix)
      // On utilise le helper du viewport pour obtenir la position exacte dans le monde
      const startMouseWorld = viewportRef.current?.screenToWorld(e.clientX, e.clientY);

      if (!startMouseWorld) return;

      const initDragState = {
        active: true,
        handleType,
        startMouseWorld,
      }

      if (basemapHandle) {
        initDragState.startBasePose = { ...basePose }
        setDragBaseMapState(initDragState);
      }
      if (legendHandle) {
        initDragState.startFormat = { ...legendFormat }
        setDragLegendState(initDragState);
      }
      if (textHandle) {
        initDragState.startWidth = selectedAnnotation.width;
        initDragState.startX = selectedAnnotation.x;
        setDragTextState(initDragState);
      }

      document.body.style.cursor = handleType === 'MOVE' ? 'grabbing' : 'crosshair';
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
        ...(enabledDrawingMode && {
          '& *': {
            cursor: 'crosshair !important',
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
            visible={!!enabledDrawingMode || dragState?.active}
            newAnnotation={newAnnotation}
          />
            <SnappingLayer
              ref={snappingLayerRef}
              viewportScale={targetPose.k} // To keep circle 8px fixed
              color="#ff00ff"
              onMouseDown={handleMarkerMouseDown}
              isDrawing={Boolean(enabledDrawingMode)}
              selectedPointId={selectedPointId}
            />
            <ClosingMarker
              ref={closingMarkerRef}
              onClick={handleClosingClick}
            />

          </>
        }
        htmlOverlay={
          <>
            <Box sx={{ position: 'absolute', bottom: "4px", left: "40px", zIndex: 1 }}>
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
        </g>

        {(dragState?.active || dragState?.frozen) && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <TransientTopologyLayer
              annotations={annotations}
              movingPointId={dragState.pointId}
              originalPointIdForDuplication={dragState.isDuplicateMode ? dragState.originalPointId : null}
              currentPos={dragState.currentPos}
              viewportScale={targetPose.k * cameraZoom}
              virtualInsertion={virtualInsertion}
              selectedAnnotationId={selectedNode?.nodeId?.replace("label::", "")}
            />
          </g>
        )}


        {/* --- Affichage conditionnel : Seulement si 'active' est vrai --- */}
        {dragAnnotationState?.active && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <TransientAnnotationLayer
              annotation={selectedAnnotation}
              deltaPos={dragAnnotationState.deltaPos}
              partType={dragAnnotationState.partType}
              basePose={targetPose}
              baseMapMeterByPx={baseMapMeterByPx}
            />
          </g>
        )}

        {(enabledDrawingMode && drawingPoints.length > 0) && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <DrawingLayer
              ref={drawingLayerRef} // <--- On branche la télécommande ici
              points={drawingPoints}
              newAnnotation={newAnnotation}
              onHoverFirstPoint={handleHoverFirstPoint}
              onLeaveFirstPoint={handleLeaveFirstPoint}
              enabledDrawingMode={enabledDrawingMode}
              containerK={targetPose.k}
            />
          </g>

        )}

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

        {/* Le composant Loupe */}
        {zoomContainer ? createPortal(<SmartDetectLayer
          ref={smartDetectRef}
          sourceImage={sourceImageEl}
          rotation={rotation}
          loupeSize={LOUPE_SIZE}
          onSmartShapeDetected={handleSmartShapeDetected}
          enabled={enabledDrawingMode === 'SMART_DETECT' || showSmartDetectRef.current}
        />, zoomContainer) : null}
      </>


    </Box >
  );
});

export default InteractionLayer;