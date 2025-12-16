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
import getAnnotationEditionPanelAnchor from 'Features/annotations/utils/getAnnotationEditionPanelAnchor';
import getAnnotationLabelPropsFromAnnotation from 'Features/annotations/utils/getAnnotationLabelPropsFromAnnotation';

import cv from "Features/opencv/services/opencvService";
import editor from "App/editor";

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
  legendFormat,
  onLegendFormatChange,
}
  , ref) => {
  const dispatch = useDispatch();

  // constants

  const SNAP_THRESHOLD_ABSOLUTE = 24;
  const DRAG_THRESHOLD_PX = 3; // Seuil de déplacement pour activer le drag

  // refs

  const viewportRef = useRef(null); // Ref vers la caméra
  const drawingLayerRef = useRef(null);
  const screenCursorRef = useRef(null);
  const snappingLayerRef = useRef(null);
  const closingMarkerRef = useRef(null);
  const helperScaleRef = useRef(null);
  const baseMapRafRef = useRef(null); // Raf = requestAnimationFrame, pour contrôle du resize de la map.

  // context

  const { setHoveredNode, setHiddenAnnotationIds, setDraggingAnnotationId, setBasePose } = useInteraction();

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

  // cameraZoom

  const cameraZoom = viewportRef.current?.getZoom() || 1;

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


  // drag state

  const [dragState, setDragState] = useState(null);
  // Structure: { active: boolean, pointId: string, currentPos: {x,y} }

  const [dragAnnotationState, setDragAnnotationState] = useState(null);
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
    if (pointsToSave.length === 1) {
      onCommitDrawingRef.current({ points: pointsToSave });
    } else {
      console.log("⚠️ erreur création d'un point.");
    }

    // Nettoyage
    setDrawingPoints([]);
    dispatch(setEnabledDrawingMode(null));
  };

  const commitPolyline = (event) => {
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

      if (e.repeat) return;

      switch (e.key) {
        // 1. ESCAPE : Reset Selection
        case 'Escape':
          console.log("Action: Reset Selection & Tool");
          resetNewAnnotation();
          dispatch(setEnabledDrawingMode(null));
          dispatch(setSelectedNode(null));
          setHiddenAnnotationIds([]);
          setDrawingPoints([]);
          setCutHostId(null);
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


      if (onCommitPointsFromDropFill) {
        onCommitPointsFromDropFill(points);
      }
      dispatch(setEnabledDrawingMode(null));
    }

    else if (!enabledDrawingMode) {
      const nativeTarget = event.nativeEvent?.target || event.target;
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
          setHiddenAnnotationIds([hit?.dataset.nodeId]);

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
    if (dragState?.active) {
      const localPos = toLocalCoords(worldPos);
      setDragState(prev => ({ ...prev, currentPos: localPos }));
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

      // Si on dépasse le seuil, on active le drag
      if (dist > DRAG_THRESHOLD_PX) {
        setDragAnnotationState(prev => ({
          ...prev,
          pending: false,
          active: true
        }));
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
      setDragAnnotationState(prev => ({ ...prev, deltaPos, localPos: currentMouseInLocal }));
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
      if ((event.shiftKey || event.evt?.shiftKey) && drawingPoints.length > 0) {
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

    if (dragLegendState?.active) {
      setDragLegendState(null);
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
    }

    // --- MODIFICATION ICI : On ne commit que si c'était réellement actif ---
    else if (dragAnnotationState) {
      // Si on était en 'pending' (juste un clic) ou 'active' (vrai drag)
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

    const basemapHandle = target.closest('[data-interaction="transform-basemap"]');
    const legendHandle = target.closest('[data-interaction="transform-legend"]');
    const textHandle = target.closest('[data-interaction="transform-text"]');


    if (draggableGroup) {

      e.stopPropagation();
      e.preventDefault();

      console.log("[InteractionLayer] mouse down on node", draggableGroup?.dataset)
      const { nodeId } = draggableGroup.dataset;

      const worldPos = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
      const startMouseInLocal = toLocalCoords(worldPos);

      // --- MODIFICATION ICI ---
      // On initialise en 'pending' (attente de mouvement)
      setDragAnnotationState({
        active: false, // Pas encore visuellement actif
        pending: true, // Nouveau flag
        selectedAnnotationId: nodeId,
        startMouseInLocal,
        partType,
        startMouseScreen: { x: e.clientX, y: e.clientY } // Stocker la position écran initiale
      });
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