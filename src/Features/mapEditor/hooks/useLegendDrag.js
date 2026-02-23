import { useState, useRef, useCallback } from "react";

/**
 * Hook qui gère le drag de la Légende (déplacement et redimensionnement).
 *
 * Pas d'impact ownership (la légende est un élément global).
 */
export default function useLegendDrag({
  bgPose,
  legendFormat,
  onLegendFormatChange,
  viewportRef,
}) {
  // --- State ---

  const [dragLegendState, setDragLegendState] = useState(null);

  // --- Refs pour accès synchrone ---

  const legendFormatRef = useRef(legendFormat);
  legendFormatRef.current = legendFormat;

  const onLegendFormatChangeRef = useRef(onLegendFormatChange);
  onLegendFormatChangeRef.current = onLegendFormatChange;

  // --- Init ---

  /**
   * Démarre un drag de la légende.
   *
   * @param {string} handleType - 'MOVE' | 'E' | 'W'
   * @param {MouseEvent} e
   */
  const initLegendDrag = useCallback((handleType, e) => {
    const startMouseWorld = viewportRef.current?.screenToWorld(e.clientX, e.clientY);
    if (!startMouseWorld) return;

    setDragLegendState({
      active: true,
      handleType,
      startMouseWorld,
      startFormat: { ...legendFormatRef.current },
    });

    document.body.style.cursor = handleType === "MOVE" ? "grabbing" : "crosshair";
  }, [viewportRef]);

  // --- Move ---

  /**
   * Gère le mouvement de la souris pendant un drag de légende.
   *
   * @param {{ x: number, y: number }} worldPos - Position monde courante
   * @returns {boolean} true si l'événement a été consommé
   */
  const handleLegendDragMove = useCallback((worldPos) => {
    const _state = dragLegendState;
    if (!_state?.active) return false;

    const { startMouseWorld, startFormat, handleType } = _state;

    // Conversion delta monde -> delta local BG
    const dxWorld = worldPos.x - startMouseWorld.x;
    const dyWorld = worldPos.y - startMouseWorld.y;

    const dxLocal = dxWorld / bgPose.k;
    const dyLocal = dyWorld / bgPose.k;

    let newX = startFormat.x;
    let newY = startFormat.y;
    let newWidth = startFormat.width;

    // --- GESTION POSITION (Move) ---
    if (handleType === "MOVE") {
      newX += dxLocal;
      newY += dyLocal;
    }
    // --- GESTION LARGEUR (Principale) ---
    else if (handleType.includes("E")) {
      newWidth = Math.max(50, startFormat.width + dxLocal);
    } else if (handleType.includes("W")) {
      const possibleWidth = startFormat.width - dxLocal;
      if (possibleWidth > 50) {
        newWidth = possibleWidth;
        newX = startFormat.x + dxLocal;
      }
    }

    const _onChange = onLegendFormatChangeRef.current;
    if (_onChange) _onChange({ x: newX, y: newY, width: newWidth });

    return true; // Action exclusive
  }, [dragLegendState, bgPose]);

  // --- End ---

  /**
   * Gère la fin du drag de légende (mouseUp).
   *
   * @returns {boolean} true si l'événement a été traité
   */
  const handleLegendDragEnd = useCallback(() => {
    if (!dragLegendState?.active) return false;

    setDragLegendState(null);
    document.body.style.cursor = "";
    return true;
  }, [dragLegendState]);

  return {
    dragLegendState,
    initLegendDrag,
    handleLegendDragMove,
    handleLegendDragEnd,
  };
}
