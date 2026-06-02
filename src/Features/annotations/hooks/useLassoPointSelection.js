import { useState, useRef, useCallback } from "react";

// Below this screen-pixel movement the gesture is a click, not a lasso drag.
const LASSO_MOVE_THRESHOLD = 4;

/**
 * Point + segment lasso selection for when an annotation is already selected.
 * Shift+drag creates a rectangle. Hit-tested members:
 *   - points whose coords fall inside the rectangle
 *   - segments whose BOTH endpoints fall inside the rectangle
 *
 * @param {Object} params
 * @param {Function} params.toLocalCoords - Screen → Local coords conversion via viewport
 * @param {Object} params.viewportRef - Ref to viewport with screenToWorld method
 * @param {Function} params.onSelectionComplete - Callback `(pointIds, partIds)`
 * @param {Function} params.getSelectedAnnotationPoints - Returns resolved points [{id, x, y}]
 * @param {Function} [params.getSelectedAnnotationSegments] - Returns segments [{partId, p0, p1}]
 */
export default function useLassoPointSelection({
  viewportRef,
  toLocalCoords,
  onSelectionComplete,
  getSelectedAnnotationPoints,
  getSelectedAnnotationSegments,
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

  // Returns { committed }. committed === false means the gesture was a click
  // (movement below threshold): the caller should fall back to click handling.
  const endLasso = useCallback(() => {
    if (!startScreenPosRef.current || !lassoRect) return { committed: false };

    // Click vs drag: a sub-threshold rectangle is a click, not a lasso.
    const moved =
      lassoRect.width > LASSO_MOVE_THRESHOLD ||
      lassoRect.height > LASSO_MOVE_THRESHOLD;
    if (!moved) {
      startScreenPosRef.current = null;
      setLassoRect(null);
      return { committed: false };
    }

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

    const inBox = (pt) =>
      pt &&
      pt.x >= selectionBox.x &&
      pt.x <= selectionBox.x + selectionBox.width &&
      pt.y >= selectionBox.y &&
      pt.y <= selectionBox.y + selectionBox.height;

    // Hit-test individual points
    const points = getSelectedAnnotationPoints?.() || [];
    const hitPointIds = [];
    points.forEach((pt) => {
      if (inBox(pt)) hitPointIds.push(pt.id);
    });

    // Hit-test segments — both endpoints must be inside the rectangle.
    const segments = getSelectedAnnotationSegments?.() || [];
    const hitPartIds = [];
    segments.forEach((seg) => {
      if (inBox(seg.p0) && inBox(seg.p1)) hitPartIds.push(seg.partId);
    });

    if (onSelectionComplete) {
      onSelectionComplete(hitPointIds, hitPartIds);
    }

    // Reset
    startScreenPosRef.current = null;
    setLassoRect(null);

    return { committed: true };
  }, [
    lassoRect,
    viewportRef,
    toLocalCoords,
    onSelectionComplete,
    getSelectedAnnotationPoints,
    getSelectedAnnotationSegments,
  ]);

  return {
    lassoRect,
    startLasso,
    updateLasso,
    endLasso,
  };
}
