import { useState, useRef, useCallback } from "react";

/**
 * Hook qui gère le drag de la BaseMap (déplacement et redimensionnement).
 *
 * Inclut la logique de rafraîchissement via requestAnimationFrame pour la fluidité.
 * Pas d'impact ownership (la basemap est un élément global).
 */
export default function useBaseMapDrag({
  basePose,
  baseMapImageSize,
  bgPose,
  onBaseMapPoseChange,
  onBaseMapPoseCommit,
  viewportRef,
}) {
  // --- State ---

  const [dragBaseMapState, setDragBaseMapState] = useState(null);
  const baseMapRafRef = useRef(null);

  // --- Refs pour accès synchrone ---

  const basePoseRef = useRef(basePose);
  basePoseRef.current = basePose;

  const onBaseMapPoseChangeRef = useRef(onBaseMapPoseChange);
  onBaseMapPoseChangeRef.current = onBaseMapPoseChange;

  const onBaseMapPoseCommitRef = useRef(onBaseMapPoseCommit);
  onBaseMapPoseCommitRef.current = onBaseMapPoseCommit;

  // --- Init ---

  /**
   * Démarre un drag de la basemap.
   *
   * @param {string} handleType - 'MOVE' | 'SE' | 'SW' | 'NE' | 'NW'
   * @param {MouseEvent} e
   */
  const initBaseMapDrag = useCallback((handleType, e) => {
    const startMouseWorld = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
    if (!startMouseWorld) return;

    setDragBaseMapState({
      active: true,
      handleType,
      startMouseWorld,
      startBasePose: { ...basePoseRef.current },
    });

    document.body.style.cursor = handleType === "MOVE" ? "grabbing" : "crosshair";
  }, [viewportRef]);

  // --- Move ---

  /**
   * Gère le mouvement de la souris pendant un drag de basemap.
   *
   * @param {{ x: number, y: number }} worldPos - Position monde courante
   * @returns {boolean} true si l'événement a été consommé
   */
  const handleBaseMapDragMove = useCallback((worldPos) => {
    const _state = dragBaseMapState;
    if (!_state?.active) return false;

    const { startMouseWorld, startBasePose, handleType } = _state;

    // Calcul du Delta en UNITÉS MONDE
    const dxWorld = worldPos.x - startMouseWorld.x;
    const dyWorld = worldPos.y - startMouseWorld.y;

    let newBasePoseWorld = { ...startBasePose };

    // Cas 1 : Déplacement
    if (handleType === "MOVE") {
      newBasePoseWorld.x += dxWorld;
      newBasePoseWorld.y += dyWorld;
    }
    // Cas 2 : Redimensionnement
    else if (["SE", "SW", "NE", "NW"].includes(handleType)) {
      if (baseMapImageSize?.width && baseMapImageSize?.height) {
        const w = baseMapImageSize.width;
        const h = baseMapImageSize.height;

        // Calcul du changement d'échelle (Delta K)
        let deltaK = 0;
        if (handleType.includes("E")) {
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

        if (handleType.includes("W")) {
          newBasePoseWorld.x = startBasePose.x - widthChange;
        }
        if (handleType.includes("N")) {
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
      r: newBasePoseWorld.r,
    };

    const _onChange = onBaseMapPoseChangeRef.current;
    if (_onChange) {
      if (baseMapRafRef.current) {
        cancelAnimationFrame(baseMapRafRef.current);
      }
      baseMapRafRef.current = requestAnimationFrame(() => {
        _onChange(newPoseInBg);
        baseMapRafRef.current = null;
      });
    }

    return true; // Action exclusive
  }, [dragBaseMapState, baseMapImageSize, bgPose]);

  // --- End ---

  /**
   * Gère la fin du drag de basemap (mouseUp).
   *
   * @returns {boolean} true si l'événement a été traité
   */
  const handleBaseMapDragEnd = useCallback(() => {
    if (!dragBaseMapState?.active) return false;

    const _onCommit = onBaseMapPoseCommitRef.current;
    if (_onCommit) _onCommit();

    setDragBaseMapState(null);
    document.body.style.cursor = "";
    return true;
  }, [dragBaseMapState]);

  return {
    dragBaseMapState,
    initBaseMapDrag,
    handleBaseMapDragMove,
    handleBaseMapDragEnd,
  };
}
