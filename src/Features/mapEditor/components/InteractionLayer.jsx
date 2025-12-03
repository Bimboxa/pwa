// components/InteractionLayer.jsx
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';

import { useInteraction } from '../context/InteractionContext';

import { setEnabledDrawingMode } from 'Features/mapEditor/mapEditorSlice';
import { setSelectedNode } from 'Features/mapEditor/mapEditorSlice';

import Box from '@mui/material/Box';
import MapEditorViewport from 'Features/mapEditorGeneric/components/MapEditorViewport';
import DrawingLayer from 'Features/mapEditorGeneric/components/DrawingLayer';
import ScreenCursorV2 from 'Features/mapEditorGeneric/components/ScreenCursorV2';
import SnappingLayer from 'Features/mapEditorGeneric/components/SnappingLayer';
import TransientTopologyLayer from 'Features/mapEditorGeneric/components/TransientTopologyLayer';



import snapToAngle from 'Features/mapEditor/utils/snapToAngle';
import getBestSnap from 'Features/mapEditor/utils/getBestSnap';

const InteractionLayer = forwardRef(({
  children,
  enabledDrawingMode,
  onCommitDrawing,
  basePose,
  activeContext = "BASE_MAP",
  annotations, // <= snapping source.
  onPointMoveCommit,
  onSegmentSplit,
  enabled
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

  // context

  const { setHoveredNode, setHiddenAnnotationIds } = useInteraction();

  // expose handlers

  useImperativeHandle(ref, () => ({
    setCameraMatrix: (cameraMatrix) => {
      if (viewportRef.current) {
        viewportRef.current.setCameraMatrix(cameraMatrix);
      }
    },
  }));

  // cameraZoom

  const cameraZoom = viewportRef.current?.getZoom() || 1;

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

  const currentSnapRef = useRef(null); // Stocke le résultat du getBestSnap

  // drawing points

  const [drawingPoints, setDrawingPoints] = useState([]);

  const drawingPointsRef = useRef([]);
  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);


  // virtual insertion

  const [virtualInsertion, setVirtualInsertion] = useState(null);

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
  const commitPolyline = () => {
    const pointsToSave = drawingPointsRef.current; // On lit la Ref, pas le State !
    console.log("💾 COMMIT EN BASE:_1", pointsToSave);
    if (pointsToSave.length >= 2) {

      onCommitDrawingRef.current(pointsToSave);

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
          if (enabledDrawingModeRef.current === "POLYLINE") {
            commitPolyline();
          } else {
            dispatch(setEnabledDrawingMode(null));
            dispatch(setSelectedNode(null));
          }
          break;

        // 2. DELETE / BACKSPACE : Supprimer
        case 'Delete':
        case 'Backspace':
          console.log("Action: Delete Selected");
          //dispatch(deleteSelected());
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

    if (enabledDrawingMode === 'POLYLINE') {
      // Apply snapping if Shift is pressed
      let finalPos = toLocalCoords(worldPos);
      if (event.shiftKey && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        finalPos = snapToAngle(worldPos, lastPoint);
      }

      // 1. Ajouter le point (Déclenche un re-render de DrawingLayer pour la partie statique)
      setDrawingPoints(prev => [...prev, finalPos]);

      // 2. Si on a fini (ex: double clic ou fermeture), on commit
      // if (isClosing) { saveToDb(drawingPoints); setDrawingPoints([]); }
    }

    // selection

    if (!enabledDrawingMode) {
      const nativeTarget = event.nativeEvent?.target || event.target;
      const hit = nativeTarget.closest?.("[data-node-type]");
      if (hit) {
        dispatch(setSelectedNode(hit?.dataset));
      } else {
        dispatch(setSelectedNode(null));
      }
    }


  };

  // --- GESTION DU MOUVEMENT (Feedback visuel) ---
  const handleWorldMouseMove = ({ worldPos, viewportPos, event }) => {
    const imageScale = getTargetScale(); // From basePose props
    const cameraZoom = viewportRef.current?.getZoom() || 1; // From Viewport
    const scale = imageScale * cameraZoom;
    const localPos = toLocalCoords(worldPos);

    if (dragState?.active) {
      // On met à jour la position virtuelle du point
      // Note: On peut aussi appliquer du snapping ici si on veut !
      setDragState(prev => ({ ...prev, currentPos: localPos }));
      return;
    }

    // snap

    const snapThreshold = SNAP_THRESHOLD_ABSOLUTE / scale;
    const snapResult = getBestSnap(localPos, annotations, snapThreshold, true); // true = forceCenter
    if (snapResult) {

      currentSnapRef.current = snapResult;
      // 2. CONVERT BACK TO SCREEN SPACE
      // Local -> World -> Screen

      // Local -> World (Apply Image Transform)
      const pose = getTargetPose();
      const worldSnapX = snapResult.x * pose.k + pose.x;
      const worldSnapY = snapResult.y * pose.k + pose.y;

      // World -> Screen (Apply Camera Transform)
      // You need a helper from viewportRef for this direction
      const screenSnap = viewportRef.current?.worldToViewport(worldSnapX, worldSnapY);

      if (screenSnap) {
        snappingLayerRef.current?.update({ ...screenSnap, type: snapResult.type });
      }
    } else {
      snappingLayerRef.current?.update(null);
    }

    // hover

    if (enabledDrawingMode) {
      screenCursorRef.current?.move(viewportPos.x, viewportPos.y);
    }

    if (enabledDrawingMode === 'POLYLINE') {
      // A. Convert World Mouse -> Local Image Mouse
      const localPos = toLocalCoords(worldPos);

      // B. Apply Snapping (Logic should now work with Local Coords!)
      // Make sure your snapToAngle uses local coords too
      let previewPos = localPos;
      if (event.shiftKey && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        previewPos = snapToAngle(localPos, lastPoint);
      }

      // C. Update Preview
      drawingLayerRef.current?.updatePreview(previewPos);
    }

    const nativeTarget = event.nativeEvent?.target || event.target;
    const hit = nativeTarget.closest?.("[data-node-type]");
    if (hit) {
      setHoveredNode(hit?.dataset);
    } else {
      setHoveredNode(null);
    }
  };

  // --- GESTION CLICK / DRAG ---

  const handleMarkerMouseDown = (e) => {
    // 1. Prevent Viewport Pan
    e.stopPropagation();
    e.preventDefault();

    const snap = currentSnapRef.current;
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
  };

  // render

  const targetPose = getTargetPose();

  return (
    <Box
      onMouseUp={handleMouseUp}
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
        staticOverlay={
          <><ScreenCursorV2
            ref={screenCursorRef}
            visible={!!enabledDrawingMode}
            color="cyan"
          />
            <SnappingLayer
              ref={snappingLayerRef}
              viewportScale={targetPose.k} // To keep circle 8px fixed
              color="#ff00ff"
              onMouseDown={handleMarkerMouseDown}
              isDrawing={Boolean(enabledDrawingMode)}
            />
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


        {(enabledDrawingMode || drawingPoints.length > 0) && (
          <g transform={`translate(${targetPose.x}, ${targetPose.y}) scale(${targetPose.k})`}>
            <DrawingLayer
              ref={drawingLayerRef} // <--- On branche la télécommande ici
              points={drawingPoints}
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


