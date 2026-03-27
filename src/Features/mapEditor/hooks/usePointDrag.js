import { useState, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";
import { setSubSelection, setSelectedPointIds, toggleSelectedPointId, selectSelectedPointIds } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

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
  onPointSnapReplace,
  onPointDuplicateAndMoveCommit,
  onSegmentSplit,
  onToggleAnnotationPointType,
  onProjectionSnapInsert,
  // refs
  currentSnapRef,
  viewportRef,
  dispatch,
}) {
  // --- State ---

  const [dragState, setDragState] = useState(null);
  const dragStateRef = useRef(null);

  const [virtualInsertion, setVirtualInsertion] = useState(null);

  const [pointInsertedAt, setPointInsertedAt] = useState(null);

  // Multi-point selection (for toggle type check)
  const selectedPointIds = useSelector(selectSelectedPointIds);
  const selectedPointIdsRef = useRef(selectedPointIds);
  selectedPointIdsRef.current = selectedPointIds;

  // --- Refs pour accès synchrone (éviter stale closures) ---

  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const callbacksRef = useRef({
    onPointMoveCommit,
    onPointSnapReplace,
    onPointDuplicateAndMoveCommit,
    onSegmentSplit,
    onToggleAnnotationPointType,
    onProjectionSnapInsert,
  });
  callbacksRef.current = {
    onPointMoveCommit,
    onPointSnapReplace,
    onPointDuplicateAndMoveCommit,
    onSegmentSplit,
    onToggleAnnotationPointType,
    onProjectionSnapInsert,
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

      // --- CAS 2 : PROJECTION / MIDPOINT (Nouveau Point sur segment) ---
      else if (snap.type === "PROJECTION" || snap.type === "MIDPOINT") {

        // Permission check : vérifier que l'annotation cible est à moi
        if (!permissions.canEditAnnotation(snap.previewAnnotationId)) return false;

        const tempId = `temp_${nanoid()}`;

        const newDragState = {
          active: true,
          pointId: tempId,
          currentPos: { x: snap.x, y: snap.y },
          originPos: { x: snap.x, y: snap.y },
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
   * @param {{ x: number, y: number, pointId?: string }|null} snapOverride - If provided, use this position instead of worldPos (snap to vertex). pointId is the snap target's point ID.
   * @returns {boolean} true si l'événement a été consommé (action exclusive)
   */
  const handlePointDragMove = useCallback(
    (worldPos, event, snapOverride) => {
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
        const localPos = snapOverride
          ? { x: snapOverride.x, y: snapOverride.y }
          : toLocalCoords(worldPos);
        const snapTarget = snapOverride?.pointId
          ? { pointId: snapOverride.pointId }
          : null;
        const projectionSnap = snapOverride?.projectionSnap || null;
        const newDragState = {
          ...dragStateRef.current,
          currentPos: localPos,
          snapTarget,
          projectionSnap,
        };
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
  const handlePointDragEnd = useCallback((mouseEvent) => {
    const _dragState = dragStateRef.current;
    if (!_dragState) return false;

    const _virtualInsertion = virtualInsertion;
    const {
      onPointMoveCommit: _onPointMoveCommit,
      onPointSnapReplace: _onPointSnapReplace,
      onPointDuplicateAndMoveCommit: _onPointDuplicateAndMoveCommit,
      onSegmentSplit: _onSegmentSplit,
      onToggleAnnotationPointType: _onToggleAnnotationPointType,
      onProjectionSnapInsert: _onProjectionSnapInsert,
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

        // Click (not drag) → show toaster + pulse animation
        if (_dragState.originPos) {
          const dx = _dragState.currentPos.x - _dragState.originPos.x;
          const dy = _dragState.currentPos.y - _dragState.originPos.y;
          if (Math.hypot(dx, dy) < 1e-6) {
            dispatch(setToaster({ message: "Point added" }));
            setPointInsertedAt({ x: _dragState.currentPos.x, y: _dragState.currentPos.y });
            setTimeout(() => setPointInsertedAt(null), 600);
          }
        }
      } else if (_dragState.isDuplicateMode && _onPointDuplicateAndMoveCommit) {
        _onPointDuplicateAndMoveCommit({
          originalPointId: _dragState.originalPointId,
          annotationId: _dragState.affectedIds[0],
          newPos: _dragState.currentPos,
        });
      } else if (_dragState.snapTarget && _onPointSnapReplace) {
        // Snap replace: check if the annotation owning this point is NOT selected
        const _selectedAnnotation = selectedAnnotationRef.current;
        const isSelectedAnnotation = _selectedAnnotation && _dragState.affectedIds?.includes(_selectedAnnotation.id);

        if (isSelectedAnnotation) {
          // Selected annotation: just move to snapped position (keep own point ID)
          _onPointMoveCommit?.(_dragState.pointId, _dragState.currentPos);
        } else {
          // Quick edit (unselected): replace point ID with snap target
          _onPointSnapReplace({
            oldPointId: _dragState.pointId,
            snapPointId: _dragState.snapTarget.pointId,
            affectedAnnotationIds: _dragState.affectedIds,
          });
        }
      } else if (_dragState.projectionSnap) {
        // Move point to projected position
        _onPointMoveCommit?.(_dragState.pointId, _dragState.currentPos);

        // If the dragged annotation is NOT the selected (edited) one,
        // also insert this point into the target annotation's segment
        const _selectedAnnotation = selectedAnnotationRef.current;
        const isSelectedAnnotation = _selectedAnnotation && _dragState.affectedIds?.includes(_selectedAnnotation.id);
        if (!isSelectedAnnotation && _onProjectionSnapInsert) {
          _onProjectionSnapInsert({
            pointId: _dragState.pointId,
            ...(_dragState.projectionSnap),
          });
        }
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
      const pointId = _dragState.pointId;
      const annId = _dragState.affectedIds?.[0];
      const _selectedPointIds = selectedPointIdsRef.current;
      const isAlreadySelected = _selectedPointIds.includes(pointId);
      const isShift = mouseEvent?.shiftKey;

      if (isShift) {
        // Shift+click: toggle point in multi-selection
        dispatch(toggleSelectedPointId(pointId));
      } else if (isAlreadySelected) {
        // Click on already-selected point: toggle type (square <=> circle)
        callbacksRef.current.onToggleAnnotationPointType?.({
          pointId,
          annotationId: annId,
        });
      } else {
        // Click on unselected point: select it only (no type toggle)
        dispatch(setSelectedPointIds([pointId]));
      }

      // Sub-sélection du point
      dispatch(setSubSelection({ pointId }));

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
    pointInsertedAt,
    handleVertexOrProjectionMouseDown,
    handlePointDragMove,
    handlePointDragEnd,
  };
}
