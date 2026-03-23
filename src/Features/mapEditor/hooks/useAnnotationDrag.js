import { useState, useRef, useCallback, useEffect } from "react";

const DRAG_THRESHOLD_PX = 3;
const WRAPPER_NODE_ID = "wrapper";

/**
 * Hook qui gère le drag d'annotation entière (move, resize, rotate).
 * Inclut la logique de permission + convergence DB (optimistic updates).
 * Supports wrapper mode for group transforms on point-based annotations.
 *
 * Pattern performance : annotations et callbacks stockés dans des refs.
 */
export default function useAnnotationDrag({
  annotations,
  permissions,
  toLocalCoords,
  viewportRef,
  pendingMovesRef,
  setPendingMovesVersion,
  commitPendingRef,
  onAnnotationMoveCommit,
}) {
  // --- State ---

  const [dragAnnotationState, setDragAnnotationState] = useState(null);
  const dragAnnotationStateRef = useRef(null);

  // --- Refs pour accès synchrone ---

  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const onAnnotationMoveCommitRef = useRef(onAnnotationMoveCommit);
  onAnnotationMoveCommitRef.current = onAnnotationMoveCommit;

  // --- Convergence DB ---
  // Détecte quand l'annotation a réellement été mise à jour dans Dexie
  // pour supprimer l'overlay optimiste (TransientAnnotationLayer)

  const commitSnapshotRef = useRef(null);
  const commitTimeoutRef = useRef(null);
  // Store multiple pending IDs for wrapper mode
  const commitPendingIdsRef = useRef(null);

  const clearCommitPending = useCallback(() => {
    // Clear single annotation pending
    if (commitPendingRef.current) {
      pendingMovesRef.current.delete(commitPendingRef.current);
      commitPendingRef.current = null;
      commitSnapshotRef.current = null;
      setPendingMovesVersion((v) => v + 1);
    }
    // Clear wrapper pending (multiple annotations)
    if (commitPendingIdsRef.current) {
      for (const id of commitPendingIdsRef.current) {
        pendingMovesRef.current.delete(id);
      }
      commitPendingIdsRef.current = null;
      commitSnapshotRef.current = null;
      setPendingMovesVersion((v) => v + 1);
    }
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = null;
    }
  }, [commitPendingRef, pendingMovesRef, setPendingMovesVersion]);

  const startCommitPendingWatch = useCallback(() => {
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = setTimeout(() => {
      clearCommitPending();
    }, 500);
  }, [clearCommitPending]);

  // Détection de convergence par snapshot
  useEffect(() => {
    if (!commitPendingRef.current || !commitSnapshotRef.current) return;

    const ann = annotations?.find((a) => a.id === commitPendingRef.current);
    if (!ann) return;

    const snap = commitSnapshotRef.current;
    let hasChanged = false;

    if (ann.type === "IMAGE" || ann.type === "RECTANGLE") {
      hasChanged =
        ann.bbox?.x !== snap.bboxX ||
        ann.bbox?.y !== snap.bboxY ||
        ann.bbox?.width !== snap.bboxW ||
        ann.bbox?.height !== snap.bboxH ||
        ann.rotation !== snap.rotation;
    } else if (ann.type === "MARKER" || ann.type === "POINT") {
      hasChanged =
        ann.point?.x !== snap.pointX || ann.point?.y !== snap.pointY;
    } else if (ann.type === "LABEL") {
      hasChanged =
        ann.targetPoint?.x !== snap.targetX ||
        ann.targetPoint?.y !== snap.targetY ||
        ann.labelPoint?.x !== snap.labelX ||
        ann.labelPoint?.y !== snap.labelY;
    } else {
      const firstPt = ann.points?.[0];
      const pointsChanged =
        firstPt?.x !== snap.firstPointX || firstPt?.y !== snap.firstPointY;
      // For rotation, also wait for the rotation metadata to be updated
      const rotationChanged = snap.rotation !== undefined
        ? ann.rotation !== snap.rotation
        : true;
      hasChanged = pointsChanged && rotationChanged;
    }

    if (hasChanged) {
      clearCommitPending();
    }
  }, [annotations, clearCommitPending, commitPendingRef]);

  // --- Initiation ---

  /**
   * Démarre un drag d'annotation (move, resize, ou rotate).
   * Retourne false si l'utilisateur n'a pas la permission.
   *
   * @param {{ nodeId: string, startMouseInLocal: {x,y}, partType: string|null, startMouseScreen: {x,y}, nodeContext?: string, wrapperAnnotationIds?: string[], wrapperBbox?: Object }} params
   * @returns {boolean} true si le drag a été initié
   */
  const initAnnotationDrag = useCallback(
    ({ nodeId, startMouseInLocal, partType, startMouseScreen, nodeContext, wrapperAnnotationIds, wrapperBbox }) => {
      const isWrapper = nodeId === WRAPPER_NODE_ID;

      // GUARD : bloquer si pas propriétaire
      if (!isWrapper && !permissions.canEditAnnotation(nodeId)) return false;

      // GUARD : en mode wrapper, vérifier toutes les annotations
      if (isWrapper && wrapperAnnotationIds?.length > 0) {
        for (const annId of wrapperAnnotationIds) {
          if (!permissions.canEditAnnotation(annId)) return false;
        }
      }

      const newState = {
        active: false,
        pending: true,
        selectedAnnotationId: nodeId,
        startMouseInLocal,
        partType: partType || null,
        startMouseScreen,
        nodeContext,
        // Wrapper-specific state
        isWrapper,
        wrapperAnnotationIds: isWrapper ? wrapperAnnotationIds : null,
        wrapperBbox: isWrapper ? wrapperBbox : null,
      };

      setDragAnnotationState(newState);
      dragAnnotationStateRef.current = newState;
      return true;
    },
    [permissions]
  );

  // --- Move ---

  /**
   * Gère le mouvement de la souris pendant un drag d'annotation.
   *
   * @param {MouseEvent} event
   * @returns {boolean} true si l'événement a été consommé
   */
  const handleAnnotationDragMove = useCallback(
    (event) => {
      const _state = dragAnnotationStateRef.current;
      if (!_state) return false;

      // Threshold check
      if (_state.pending) {
        const dx = event.clientX - _state.startMouseScreen.x;
        const dy = event.clientY - _state.startMouseScreen.y;
        const dist = Math.hypot(dx, dy);

        if (dist > DRAG_THRESHOLD_PX) {
          const newState = {
            ..._state,
            pending: false,
            active: true,
          };

          setDragAnnotationState(newState);
          dragAnnotationStateRef.current = newState;

          // Optimistic overlay
          if (_state.isWrapper && _state.wrapperAnnotationIds) {
            // Set pending moves for ALL wrapped annotations
            for (const annId of _state.wrapperAnnotationIds) {
              pendingMovesRef.current.set(annId, {
                deltaPos: { x: 0, y: 0 },
                partType: _state.partType || null,
                wrapperBbox: _state.wrapperBbox,
              });
            }
          } else {
            pendingMovesRef.current.set(_state.selectedAnnotationId, {
              deltaPos: { x: 0, y: 0 },
              partType: _state.partType || null,
            });
          }
          setPendingMovesVersion((v) => v + 1);
        } else {
          return true; // Absorber le mouvement
        }
      }

      // Active drag
      if (dragAnnotationStateRef.current?.active) {
        const currentMouseInWorld = viewportRef.current?.screenToWorld(
          event.clientX,
          event.clientY
        );
        const currentMouseInLocal = toLocalCoords(currentMouseInWorld);
        const deltaPos = {
          x:
            currentMouseInLocal.x -
            dragAnnotationStateRef.current.startMouseInLocal.x,
          y:
            currentMouseInLocal.y -
            dragAnnotationStateRef.current.startMouseInLocal.y,
        };

        // Update pendingMove ref (pas de re-render, lu par TransientAnnotationLayer)
        if (dragAnnotationStateRef.current.isWrapper && dragAnnotationStateRef.current.wrapperAnnotationIds) {
          // Update pending moves for ALL wrapped annotations
          for (const annId of dragAnnotationStateRef.current.wrapperAnnotationIds) {
            pendingMovesRef.current.set(annId, {
              deltaPos,
              partType: dragAnnotationStateRef.current.partType || null,
              wrapperBbox: dragAnnotationStateRef.current.wrapperBbox,
            });
          }
        } else {
          pendingMovesRef.current.set(
            dragAnnotationStateRef.current.selectedAnnotationId,
            {
              deltaPos,
              partType: dragAnnotationStateRef.current.partType || null,
            }
          );
        }

        const newState = {
          ...dragAnnotationStateRef.current,
          deltaPos,
          localPos: currentMouseInLocal,
        };
        setDragAnnotationState(newState);
        dragAnnotationStateRef.current = newState;
        return true; // Action exclusive
      }

      return false;
    },
    [
      toLocalCoords,
      viewportRef,
      pendingMovesRef,
      setPendingMovesVersion,
    ]
  );

  // --- Commit ---

  /**
   * Gère la fin du drag d'annotation (mouseUp).
   *
   * @returns {boolean} true si l'événement a été traité
   */
  const handleAnnotationDragEnd = useCallback(() => {
    const _state = dragAnnotationStateRef.current;
    if (!_state) return false;

    if (_state.active) {
      const _onCommit = onAnnotationMoveCommitRef.current;
      if (_onCommit) {
        _onCommit(
          _state.selectedAnnotationId,
          _state.deltaPos,
          _state.partType,
          _state.localPos
        );
      }

      if (_state.isWrapper && _state.wrapperAnnotationIds) {
        // Wrapper mode: track convergence on the first wrapped annotation
        const firstAnnId = _state.wrapperAnnotationIds[0];
        const ann = annotationsRef.current?.find((a) => a.id === firstAnnId);
        if (ann) {
          const snap = {
            firstPointX: ann.points?.[0]?.x,
            firstPointY: ann.points?.[0]?.y,
          };
          // For ROTATE, also track rotation to avoid detecting convergence
          // before the annotation metadata (rotation/rotationCenter) is committed.
          if (_state.partType === "ROTATE") {
            snap.rotation = ann.rotation;
          }
          commitSnapshotRef.current = snap;
        }
        commitPendingRef.current = firstAnnId;
        commitPendingIdsRef.current = [..._state.wrapperAnnotationIds];
      } else {
        // Single annotation mode
        const annId = _state.selectedAnnotationId;
        const ann = annotationsRef.current?.find((a) => a.id === annId);
        if (ann) {
          commitSnapshotRef.current = {
            bboxX: ann.bbox?.x,
            bboxY: ann.bbox?.y,
            bboxW: ann.bbox?.width,
            bboxH: ann.bbox?.height,
            rotation: ann.rotation,
            pointX: ann.point?.x,
            pointY: ann.point?.y,
            targetX: ann.targetPoint?.x,
            targetY: ann.targetPoint?.y,
            labelX: ann.labelPoint?.x,
            labelY: ann.labelPoint?.y,
            firstPointX: ann.points?.[0]?.x,
            firstPointY: ann.points?.[0]?.y,
          };
        }
        commitPendingRef.current = annId;
      }
      startCommitPendingWatch();
    }

    // Cleanup immédiat
    setDragAnnotationState(null);
    dragAnnotationStateRef.current = null;
    document.body.style.cursor = "";
    return true;
  }, [commitPendingRef, startCommitPendingWatch]);

  return {
    dragAnnotationState,
    dragAnnotationStateRef,
    initAnnotationDrag,
    handleAnnotationDragMove,
    handleAnnotationDragEnd,
    clearCommitPending,
    startCommitPendingWatch,
  };
}
