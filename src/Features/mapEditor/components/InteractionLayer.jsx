// components/InteractionLayer.jsx
import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';

import { useInteraction } from '../context/InteractionContext';

import { setEnabledDrawingMode } from 'Features/mapEditor/mapEditorSlice';
import { setSelectedNode } from 'Features/mapEditor/mapEditorSlice';
import { setAnnotationToolbarPosition } from 'Features/mapEditor/mapEditorSlice';
import { setOpenDialogDeleteSelectedAnnotation } from 'Features/annotations/annotationsSlice';
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import useResetNewAnnotation from 'Features/annotations/hooks/useResetNewAnnotation';

import Box from '@mui/material/Box';
import MapEditorViewport from 'Features/mapEditorGeneric/components/MapEditorViewport';
import DrawingLayer from 'Features/mapEditorGeneric/components/DrawingLayer';
import ScreenCursorV2 from 'Features/mapEditorGeneric/components/ScreenCursorV2';
import SnappingLayer from 'Features/mapEditorGeneric/components/SnappingLayer';
import TransientTopologyLayer from 'Features/mapEditorGeneric/components/TransientTopologyLayer';
import TransientAnnotationLayer from 'Features/mapEditorGeneric/components/TransientAnnotationLayer';
import ClosingMarker from 'Features/mapEditorGeneric/components/ClosingMarker';
import HelperScale from 'Features/mapEditorGeneric/components/HelperScale';
import MapTooltip from 'Features/mapEditorGeneric/components/MapTooltip';



import snapToAngle from 'Features/mapEditor/utils/snapToAngle';
import getBestSnap from 'Features/mapEditor/utils/getBestSnap';

const InteractionLayer = forwardRef(({
  children,
  enabledDrawingMode,
  newAnnotation,
  onCommitDrawing,
  basePose,
  onBaseMapPoseChange,
  onBaseMapPoseCommit,
  baseMapImageSize,
  bgPose = { x: 0, y: 0, k: 1 },
  activeContext = "BASE_MAP",
  annotations, // <= snapping source.
  onPointMoveCommit,
  onAnnotationMoveCommit,
  onSegmentSplit,
  snappingEnabled = true,
  selectedNode,
  baseMapMeterByPx,
  showBgImage,
}
  , ref) => {
  const dispatch = useDispatch();

  // constants

  const SNAP_THRESHOLD_ABSOLUTE = 24;

  // refs

  const viewportRef = useRef(null); // Ref vers la caméra
  const drawingLayerRef = useRef(null);
  const screenCursorRef = useRef(null);
  const snappingLayerRef = useRef(null);
  const closingMarkerRef = useRef(null);
  const helperScaleRef = useRef(null);

  // context

  const { setHoveredNode, setHiddenAnnotationIds, setDraggingAnnotationId } = useInteraction();

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
    return annotations?.find((annotation) => annotation.id === selectedNode?.nodeId);
  }, [annotations, selectedNode?.nodeId]);

  // cameraZoom

  const cameraZoom = viewportRef.current?.getZoom() || 1;

  // update helper scale

  function handleCameraChange(cameraMatrix) {
    helperScaleRef.current?.updateZoom(cameraMatrix.k);
  }

  // tooltip

  const [tooltipData, setTooltipData] = useState(null);
  const tooltipRef = useRef(null);

  // target pose & scale

  const basePoseRef = useRef(basePose);
  useEffect(() => {
    basePoseRef.current = basePose;
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


  // drag state

  const [dragState, setDragState] = useState(null);
  // Structure: { active: boolean, pointId: string, currentPos: {x,y} }

  const [dragAnnotationState, setDragAnnotationState] = useState(null);
  // Structure: { active: boolean, annotationId: string, currentPos: {x,y} }

  // State pour le drag de la BaseMap
  const [dragBaseMapState, setDragBaseMapState] = useState(null);
  // { active: true, handleType: 'MOVE'|'SE'..., startMouseScreen: {x,y}, startBasePose: {x,y,k} }

  const currentSnapRef = useRef(null); // Stocke le résultat du getBestSnap

  // drawing points

  const [drawingPoints, setDrawingPoints] = useState([]);

  const drawingPointsRef = useRef([]);
  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);


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


  // 1. Calculer le style curseur du conteneur
  const getCursorStyle = () => {
    if (dragState?.active) return 'crosshair';
    if (enabledDrawingMode) return 'crosshair'; // Priorité 1           // Priorité 2
    return 'default';                           // Défaut
  };

  // --- LOGIQUE DE COMMIT (Sauvegarde) ---
  const commitPoint = () => {
    const pointsToSave = drawingPointsRef.current; // On lit la Ref, pas le State !
    console.log("💾 COMMIT EN BASE:_1", pointsToSave);
    if (pointsToSave.length === 1) {
      onCommitDrawingRef.current(pointsToSave);
    } else {
      console.log("⚠️ erreur création d'un point.");
    }

    // Nettoyage
    setDrawingPoints([]);
    dispatch(setEnabledDrawingMode(null));
  };

  const commitPolyline = (event) => {
    const pointsToSave = drawingPointsRef.current; // On lit la Ref, pas le State !
    console.log("💾 COMMIT EN BASE:_1", pointsToSave);
    if (pointsToSave.length >= 2) {

      onCommitDrawingRef.current(pointsToSave, event);

      // EXEMPLE D'ACTION :
      // onNewAnnotation({ type: 'POLYLINE', points: pointsToSave });
      // ou dispatch(createPolyline(pointsToSave));
    } else {
      console.log("⚠️ Pas assez de points pour créer une polyligne");
    }

    // Nettoyage
    setDrawingPoints([]);
    dispatch(setEnabledDrawingMode(null));
  };

  // --- A. GESTION DES CLAVIERS (Key Listeners) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorer si l'utilisateur écrit dans un input texte
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        console.log("Action: Key Pressed while typing");
        //return;
      }

      switch (e.key) {
        // 1. ESCAPE : Reset Selection
        case 'Escape':
          console.log("Action: Reset Selection & Tool");
          resetNewAnnotation();
          dispatch(setEnabledDrawingMode(null));
          dispatch(setSelectedNode(null));
          setHiddenAnnotationIds([]);
          setDrawingPoints([]);
          break;

        case "Enter":
          if (enabledDrawingModeRef.current === "CLICK") {
            commitPolyline();
          }
          break;

        // 2. DELETE / BACKSPACE : Supprimer
        case 'Delete':
        case 'Backspace':
          console.log("Action: Delete Selected");
          dispatch(setOpenDialogDeleteSelectedAnnotation(true));
          break;

        // 3. FLÈCHES : Pan Caméra (Délégué au Viewport)
        case 'ArrowLeft':
          viewportRef.current?.panBy(50, 0); // Déplacer de 50px
          break;
        case 'ArrowRight':
          viewportRef.current?.panBy(-50, 0);
          break;
        case 'ArrowUp':
          viewportRef.current?.panBy(0, 50);
          break;
        case 'ArrowDown':
          viewportRef.current?.panBy(0, -50);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // --- GESTION DES CLICS (Ajout de point) ---
  const handleWorldClick = ({ worldPos, viewportPos, event }) => {


    //Déclencher le flash visuel au clic
    if (enabledDrawingMode) {
      screenCursorRef.current?.triggerFlash();
    }

    if (enabledDrawingMode === 'CLICK') {
      // Apply snapping if Shift is pressed
      let finalPos = toLocalCoords(worldPos);
      if (event.shiftKey && drawingPoints.length > 0) {
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
      if (event.shiftKey && drawingPoints.length > 0) {
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
      if (event.shiftKey && drawingPoints.length > 0) {
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

    else if (!enabledDrawingMode) {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hit = nativeTarget.closest?.("[data-node-type]");
      if (hit) {
        console.log("[InteractionLayer] selected node", hit?.dataset)
        if (!showBgImage && hit?.dataset?.nodeType === "BASE_MAP") {
          dispatch(setSelectedNode(null))
          setHiddenAnnotationIds([]);
          dispatch(setAnnotationToolbarPosition(null));
        } else if (hit?.dataset?.nodeType === "ANNOTATION" && !showBgImage) {
          dispatch(setSelectedNode(hit?.dataset));
          setHiddenAnnotationIds([hit?.dataset.nodeId]);
          dispatch(
            setAnnotationToolbarPosition({ x: event.clientX, y: event.clientY })
          );
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

    // --- 1. DÉTECTION DE L'ÉTAT D'INTERACTION ---
    // Est-ce qu'une action prioritaire est en cours ?
    const isInteracting =
      isPanning ||
      dragState?.active ||
      dragAnnotationState?.active ||
      dragBaseMapState?.active ||
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
    if (dragState?.active) {
      const localPos = toLocalCoords(worldPos);
      setDragState(prev => ({ ...prev, currentPos: localPos }));
      return; // Action exclusive, on arrête ici
    }

    // B. DRAG BASEMAP (Image de fond)
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
        onBaseMapPoseChange(newPoseInBg);
      }
      return; // Action exclusive
    }

    // C. DRAG ANNOTATION (Objet entier)
    if (dragAnnotationState?.active) {
      const currentMouseInWorld = viewportRef.current?.screenToWorld(event.clientX, event.clientY);
      const currentMouseInLocal = toLocalCoords(currentMouseInWorld);
      const deltaPos = {
        x: currentMouseInLocal.x - dragAnnotationState.startMouseInLocal.x,
        y: currentMouseInLocal.y - dragAnnotationState.startMouseInLocal.y
      };
      setDragAnnotationState(prev => ({ ...prev, deltaPos }));
      return; // Action exclusive
    }

    // D. SNAPPING
    // Correction : On autorise le snapping pendant le dessin (enabledDrawingMode)
    // On l'interdit seulement pour le Pan ou le Drag d'objets lourds
    const preventSnapping = isPanning || dragAnnotationState?.active || dragBaseMapState?.active;

    let snapResult;
    if (snappingEnabled && !preventSnapping) {
      const imageScale = getTargetScale();
      const scale = imageScale * cameraZoom;
      const localPos = toLocalCoords(worldPos);
      const snapThreshold = SNAP_THRESHOLD_ABSOLUTE / scale;

      snapResult = getBestSnap(localPos, annotations, snapThreshold, true);

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
      if (event.shiftKey && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        previewPos = snapToAngle(localPos, lastPoint);
      }
      drawingLayerRef.current?.updatePreview(previewPos);
    }

    // --- 5. DÉTECTION DU HOVER (HIT TEST) ---
    // Le Correctif est ici : On ne cherche ce qu'il y a sous la souris 
    // QUE si on est "au repos" (!isInteracting).

    if (!isInteracting) {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hit = nativeTarget.closest?.("[data-node-type]");

      if (hit) {
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

    // ==================
    // Dessin
    // ==================

    const snap = currentSnapRef.current;
    console.log("[InteractionLayer] snap", snap);
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

      // 3. On ajoute le point (avec l'ID s'il existe)
      setDrawingPoints(prev => [...prev, pointToAdd]);

      // On force un flash visuel
      screenCursorRef.current?.triggerFlash();

      // On s'arrête ici
      return;
    }
    // =======================================================

    // --- CAS 1 : EXISTING VERTEX ---
    if (snap.type === 'VERTEX') {
      const pointId = snap.id;
      const affectedIds = annotations
        .filter(ann => ann.points?.some(pt => pt.id === pointId))
        .map(ann => ann.id);

      setDragState({
        active: true,
        pointId: pointId,
        currentPos: { x: snap.x, y: snap.y }
      });
      setVirtualInsertion(null); // Pas virtuel
      setHiddenAnnotationIds(affectedIds);
    }

    // --- CAS 2 : PROJECTION (Nouveau Point) ---
    else if (snap.type === 'PROJECTION') {
      // 1. Générer un ID temporaire pour l'UI
      const tempId = `temp_${nanoid()}`;

      // 2. Configurer le drag state
      setDragState({
        active: true,
        pointId: tempId,
        currentPos: { x: snap.x, y: snap.y }
      });

      // 3. Configurer l'insertion virtuelle
      // getBestSnap doit retourner annotationId et segmentIndex !
      setVirtualInsertion({
        // Pour le visuel immédiat (on en montre qu'un seul qui bouge pour pas alourdir le DOM)
        annotationId: snap.previewAnnotationId,
        segmentIndex: snap.previewSegmentIndex,

        // Pour la logique finale
        segmentStartId: snap.segmentStartId,
        segmentEndId: snap.segmentEndId
      });

      // 4. Cacher l'annotation parente (pour ne pas voir le trait droit en dessous)
      setHiddenAnnotationIds([snap.previewAnnotationId]);
    }

    snappingLayerRef.current?.update(null); // hide snapping circle

    // FORCE CURSOR ON BODY
    document.body.style.cursor = 'crosshair';
  };


  const handleMouseUp = () => {
    if (dragBaseMapState?.active) {
      // Comme on a mis à jour Redux en temps réel via onBaseMapPoseChange,
      // on peut soit passer la dernière valeur calculée, soit (mieux) laisser
      // le parent récupérer la valeur courante du store pour la sauvegarder.
      // Mais pour être explicite, recalculons-la ou passons null pour dire "Commit ce que tu as".

      // Ici, on suppose que le parent sait quelle est la valeur courante via Redux
      if (onBaseMapPoseCommit) {
        onBaseMapPoseCommit();
      }

      setDragBaseMapState(null);
      document.body.style.cursor = '';
    }

    if (dragState?.active) {

      // CAS A : SPLIT (Si on a une insertion virtuelle)
      if (virtualInsertion && onSegmentSplit) {
        onSegmentSplit({
          segmentStartId: virtualInsertion.segmentStartId, // <--- VITAL
          segmentEndId: virtualInsertion.segmentEndId,     // <--- VITAL
          x: dragState.currentPos.x,
          y: dragState.currentPos.y
        });
      }
      // CAS B : MOVE SIMPLE
      else if (onPointMoveCommit) {
        onPointMoveCommit(dragState.pointId, dragState.currentPos);
      }

      // Cleanup
      setDragState(null);
      setVirtualInsertion(null);
      setTimeout(() => setHiddenAnnotationIds([]), 30);
      document.body.style.cursor = '';
    } else if (dragAnnotationState?.active) {

      if (onAnnotationMoveCommit) {
        onAnnotationMoveCommit(dragAnnotationState.selectedAnnotationId, dragAnnotationState.deltaPos);
      }

      setDragAnnotationState(null);
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

    const draggableGroup = target.closest('[data-interaction="draggable"]');
    const basemapHandle = target.closest('[data-interaction="transform-basemap"]');


    if (draggableGroup) {

      e.stopPropagation();
      e.preventDefault();

      console.log("[InteractionLayer] mouse down on node", draggableGroup?.dataset)
      const { nodeId } = draggableGroup.dataset;

      const worldPos = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
      const startMouseInLocal = toLocalCoords(worldPos);

      setDragAnnotationState({
        active: true,
        selectedAnnotationId: nodeId,
        startMouseInLocal,
      });
      setDraggingAnnotationId(nodeId);
    }

    if (basemapHandle) {
      e.stopPropagation();
      e.preventDefault();

      const handleType = basemapHandle.dataset.handleType;

      // 1. CONVERSION ÉCRAN -> MONDE (Prend en compte la CameraMatrix)
      // On utilise le helper du viewport pour obtenir la position exacte dans le monde
      const startMouseWorld = viewportRef.current?.screenToWorld(e.clientX, e.clientY);

      if (!startMouseWorld) return;

      setDragBaseMapState({
        active: true,
        handleType,
        // On stocke le point de départ en MONDE
        startMouseWorld: startMouseWorld,
        // On stocke la pose de l'objet en MONDE (copie de la prop basePose)
        startBasePose: { ...basePose }
      });

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

        {dragState?.active && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <TransientTopologyLayer
              annotations={annotations}
              movingPointId={dragState.pointId}
              currentPos={dragState.currentPos}
              viewportScale={targetPose.k * cameraZoom}
              virtualInsertion={virtualInsertion}
            />
          </g>
        )}

        {dragAnnotationState?.active && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <TransientAnnotationLayer
              annotation={selectedAnnotation}
              deltaPos={dragAnnotationState.deltaPos}
              basePose={basePose}
              baseMapMeterByPx={baseMapMeterByPx}
            />
          </g>
        )}


        {(enabledDrawingMode || drawingPoints.length > 0) && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <DrawingLayer
              ref={drawingLayerRef} // <--- On branche la télécommande ici
              points={drawingPoints}
              newAnnotation={newAnnotation}
              onHoverFirstPoint={handleHoverFirstPoint}
              onLeaveFirstPoint={handleLeaveFirstPoint}
              enabledDrawingMode={enabledDrawingMode}
            />
          </g>

        )}

        {/* Exemple : Afficher un curseur de snapping personnalisé ici */}
        {/* <SnapCursor position={currentSnapPos} /> */}
      </MapEditorViewport>
    </Box >
  );
});

export default InteractionLayer;


