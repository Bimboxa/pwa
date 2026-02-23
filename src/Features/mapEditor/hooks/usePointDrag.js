import { useState, useRef, useCallback } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { setSubSelection } from "Features/selection/selectionSlice";

const DRAG_THRESHOLD_PX = 3;

/**
 * Hook qui gère le drag de vertex (point existant) et l'insertion virtuelle (projection sur segment).
 * Inclut la logique de fork : quand un point partagé appartient à des annotations de propriétaires
 * différents, le mode duplication est automatiquement activé.
 *
 * Pattern performance : toutes les props instables (annotations, selectedNode, callbacks)
 * sont stockées dans des refs pour éviter les re-renders et stale closures.
 */
export default function usePointDrag({
  annotations,
  selectedNode,
  selectedAnnotationRef,
  toLocalCoords,
  permissions,
  setHiddenAnnotationIds,
  // callbacks
  onPointMoveCommit,
  onPointDuplicateAndMoveCommit,
  onSegmentSplit,
  onToggleAnnotationPointType,
  // refs
  currentSnapRef,
  viewportRef,
  dispatch,
}) {
  // --- State ---

  const [dragState, setDragState] = useState(null);
  const dragStateRef = useRef(null);

  const [virtualInsertion, setVirtualInsertion] = useState(null);

  // --- Refs pour accès synchrone (éviter stale closures) ---

  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const callbacksRef = useRef({
    onPointMoveCommit,
    onPointDuplicateAndMoveCommit,
    onSegmentSplit,
    onToggleAnnotationPointType,
  });
  callbacksRef.current = {
    onPointMoveCommit,
    onPointDuplicateAndMoveCommit,
    onSegmentSplit,
    onToggleAnnotationPointType,
  };

  // --- Handlers ---

  /**
   * Appelé par handleMarkerMouseDown quand on n'est PAS en mode dessin.
   * Gère les cas VERTEX (point existant) et PROJECTION (insertion sur segment).
   *
   * @param {{ type: string, id?: string, x: number, y: number, previewAnnotationId?: string, segmentStartId?: string, segmentEndId?: string, previewSegmentIndex?: number, cutIndex?: number }} snap
   * @param {MouseEvent} e
   * @returns {boolean} true si l'événement a été traité
   */
  const handleVertexOrProjectionMouseDown = useCallback(
    (snap, e) => {
      if (!snap) return false;

      // --- CAS 1 : EXISTING VERTEX ---
      if (snap.type === "VERTEX") {
        const pointId = snap.id;
        const _selectedNode = selectedNodeRef.current;
        const _annotations = annotationsRef.current;

        // Permission check avec fork
        const { allowed, mustFork } = permissions.checkPointPermission(pointId);
        if (!allowed) return false; // Aucune de mes annotations n'utilise ce point → bloquer

        // Détection duplication existante (annotation sélectionnée a ce point)
        const selectedAnnotationHasPoint =
          _selectedNode &&
          _annotations
            ?.find((a) => a.id === _selectedNode.nodeId)
            ?.points?.some((p) => p.id === pointId);

        // Fork automatique si des annotations étrangères partagent ce point
        const isPotentialDuplicate = mustFork || !!selectedAnnotationHasPoint;

        // Calcul des IDs affectés (toutes les annotations contenant ce point)
        const affectedIds = _annotations
          .filter((ann) => {
            const inMain = ann.points?.some((pt) => pt.id === pointId);
            const inCuts = ann.cuts?.some((cut) =>
              cut.points?.some((pt) => pt.id === pointId)
            );
            return inMain || inCuts;
          })
          .map((ann) => ann.id);

        const newDragState = {
          active: false,
          pending: true,
          pointId: pointId,
          originalPointId: pointId,
          isDuplicateMode: false,
          potentialDuplicate: isPotentialDuplicate,
          currentPos: { x: snap.x, y: snap.y },
          startMouseScreen: { x: e.clientX, y: e.clientY },
          affectedIds: affectedIds,
        };

        setDragState(newDragState);
        dragStateRef.current = newDragState;
        setVirtualInsertion(null);

        return true;
      }

      // --- CAS 2 : PROJECTION (Nouveau Point sur segment) ---
      else if (snap.type === "PROJECTION") {

        // Permission check : vérifier que l'annotation cible est à moi
        if (!permissions.canEditAnnotation(snap.previewAnnotationId)) return false;

        const tempId = `temp_${nanoid()}`;

        const newDragState = {
          active: true,
          pointId: tempId,
          currentPos: { x: snap.x, y: snap.y },
        };
        setDragState(newDragState);
        dragStateRef.current = newDragState;

        setVirtualInsertion({
          annotationId: snap.previewAnnotationId,
          segmentIndex: snap.previewSegmentIndex,
          cutIndex: snap.cutIndex,
          segmentStartId: snap.segmentStartId,
          segmentEndId: snap.segmentEndId,
        });

        setHiddenAnnotationIds([snap.previewAnnotationId]);
        return true;
      }

      return false;
    },
    [permissions, setHiddenAnnotationIds]
  );

  /**
   * Gère le mouvement de la souris pendant un drag de point.
   * Appelé par handleWorldMouseMove.
   *
   * @param {{ x: number, y: number }} worldPos - Position monde
   * @param {MouseEvent} event
   * @returns {boolean} true si l'événement a été consommé (action exclusive)
   */
  const handlePointDragMove = useCallback(
    (worldPos, event) => {
      const _dragState = dragStateRef.current;
      if (!_dragState) return false;

      // A. Pending → vérifier le seuil
      if (_dragState.pending) {
        const dx = event.clientX - _dragState.startMouseScreen.x;
        const dy = event.clientY - _dragState.startMouseScreen.y;
        const dist = Math.hypot(dx, dy);

        if (dist > DRAG_THRESHOLD_PX) {
          let finalPointId = _dragState.pointId;
          let finalIsDuplicateMode = false;
          let idsToHide = _dragState.affectedIds;

          if (_dragState.potentialDuplicate) {
            // Activation du mode fork/duplication
            finalIsDuplicateMode = true;
            finalPointId = `temp_dup_${nanoid()}`;

            // En mode fork, on ne cache QUE l'annotation sélectionnée
            const _selectedNode = selectedNodeRef.current;
            if (_selectedNode?.nodeId) {
              idsToHide = [_selectedNode.nodeId];
            }
          }

          const newDragState = {
            ..._dragState,
            pending: false,
            active: true,
            isDuplicateMode: finalIsDuplicateMode,
            pointId: finalPointId,
            affectedIds: idsToHide,
          };
          setDragState(newDragState);
          dragStateRef.current = newDragState;

          setHiddenAnnotationIds(idsToHide);
        } else {
          return true; // Absorbe le mouvement (pas encore de drag)
        }
      }

      // B. Active → mettre à jour la position
      if (dragStateRef.current?.active) {
        const localPos = toLocalCoords(worldPos);
        const newDragState = { ...dragStateRef.current, currentPos: localPos };
        setDragState(newDragState);
        dragStateRef.current = newDragState;
        return true; // Action exclusive
      }

      return false;
    },
    [toLocalCoords, setHiddenAnnotationIds]
  );

  /**
   * Gère la fin du drag de point (mouseUp).
   * Commit ou click selon l'état (active vs pending).
   *
   * @returns {boolean} true si l'événement a été traité
   */
  const handlePointDragEnd = useCallback(() => {
    const _dragState = dragStateRef.current;
    if (!_dragState) return false;

    const _virtualInsertion = virtualInsertion;
    const {
      onPointMoveCommit: _onPointMoveCommit,
      onPointDuplicateAndMoveCommit: _onPointDuplicateAndMoveCommit,
      onSegmentSplit: _onSegmentSplit,
      onToggleAnnotationPointType: _onToggleAnnotationPointType,
    } = callbacksRef.current;

    // CAS A : DRAG actif → commit
    if (_dragState.active) {
      // 1. Commit des données
      if (_virtualInsertion && _onSegmentSplit) {
        _onSegmentSplit({
          segmentStartId: _virtualInsertion.segmentStartId,
          segmentEndId: _virtualInsertion.segmentEndId,
          x: _dragState.currentPos.x,
          y: _dragState.currentPos.y,
        });
      } else if (_dragState.isDuplicateMode && _onPointDuplicateAndMoveCommit) {
        _onPointDuplicateAndMoveCommit({
          originalPointId: _dragState.originalPointId,
          annotationId: _dragState.affectedIds[0],
          newPos: _dragState.currentPos,
        });
      } else if (_onPointMoveCommit) {
        _onPointMoveCommit(_dragState.pointId, _dragState.currentPos);
      }

      // 2. Anti-clignotement (Freeze)
      const frozenState = { ..._dragState, active: false, frozen: true };
      dragStateRef.current = frozenState;
      setDragState(frozenState);

      // 3. Nettoyage différé
      setTimeout(() => {
        dragStateRef.current = null;
        setDragState(null);
        setHiddenAnnotationIds([]);
        setVirtualInsertion(null);
      }, 200);

      document.body.style.cursor = "";
      return true;
    }

    // CAS B : CLICK (pending → pas de drag)
    else if (_dragState.pending) {
      // Toggle point type si clic sur point de l'annotation sélectionnée
      if (selectedAnnotationRef.current?.id === _dragState.affectedIds[0]) {
        _onToggleAnnotationPointType?.({
          pointId: _dragState.pointId,
          annotationId: _dragState.affectedIds[0],
        });
      }

      // Sub-sélection du point
      dispatch(setSubSelection({ pointId: _dragState.pointId }));

      // Cleanup immédiat
      setDragState(null);
      dragStateRef.current = null;
      setVirtualInsertion(null);
      setHiddenAnnotationIds([]);
      return true;
    }

    return false;
  }, [virtualInsertion, dispatch, setHiddenAnnotationIds, selectedAnnotationRef]);

  return {
    dragState,
    dragStateRef,
    virtualInsertion,
    handleVertexOrProjectionMouseDown,
    handlePointDragMove,
    handlePointDragEnd,
  };
}
