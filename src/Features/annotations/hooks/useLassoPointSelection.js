import { useState, useRef, useCallback } from "react";

/**
 * Point-level lasso selection for when an annotation is already selected.
 * Shift+drag creates a rectangle that selects individual points within the annotation.
 *
 * @param {Object} params
 * @param {Function} params.toLocalCoords - Screen → Local coords conversion via viewport
 * @param {Object} params.viewportRef - Ref to viewport with screenToWorld method
 * @param {Function} params.onSelectionComplete - Callback receiving selected point IDs
 * @param {Function} params.getSelectedAnnotationPoints - Returns resolved points [{id, x, y}] of the selected annotation
 */
export default function useLassoPointSelection({
  viewportRef,
  toLocalCoords,
  onSelectionComplete,
  getSelectedAnnotationPoints,
}) {
  const [lassoRect, setLassoRect] = useState(null);
  const startScreenPosRef = useRef(null);

  const startLasso = useCallback(
    (e) => {
      if (e.shiftKey && e.button === 0) {
        startScreenPosRef.current = { x: e.clientX, y: e.clientY };
        setLassoRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
        return true;
      }
      return false;
    },
    []
  );

  const updateLasso = useCallback((e) => {
    if (!startScreenPosRef.current) return;

    const startX = startScreenPosRef.current.x;
    const startY = startScreenPosRef.current.y;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    setLassoRect({ x, y, width, height });
  }, []);

  const endLasso = useCallback(() => {
    if (!startScreenPosRef.current || !lassoRect) return;

    // Convert screen rectangle to local coords
    const p1_world = viewportRef.current.screenToWorld(
      lassoRect.x,
      lassoRect.y
    );
    const p2_world = viewportRef.current.screenToWorld(
      lassoRect.x + lassoRect.width,
      lassoRect.y + lassoRect.height
    );

    const p1_local = toLocalCoords(p1_world);
    const p2_local = toLocalCoords(p2_world);

    const selectionBox = {
      x: Math.min(p1_local.x, p2_local.x),
      y: Math.min(p1_local.y, p2_local.y),
      width: Math.abs(p2_local.x - p1_local.x),
      height: Math.abs(p2_local.y - p1_local.y),
    };

    // Hit-test individual points
    const points = getSelectedAnnotationPoints?.() || [];
    const hitPointIds = [];

    points.forEach((pt) => {
      if (
        pt.x >= selectionBox.x &&
        pt.x <= selectionBox.x + selectionBox.width &&
        pt.y >= selectionBox.y &&
        pt.y <= selectionBox.y + selectionBox.height
      ) {
        hitPointIds.push(pt.id);
      }
    });

    if (onSelectionComplete) {
      onSelectionComplete(hitPointIds);
    }

    // Reset
    startScreenPosRef.current = null;
    setLassoRect(null);
  }, [
    lassoRect,
    viewportRef,
    toLocalCoords,
    onSelectionComplete,
    getSelectedAnnotationPoints,
  ]);

  return {
    lassoRect,
    startLasso,
    updateLasso,
    endLasso,
  };
}
