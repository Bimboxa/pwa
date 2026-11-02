import { useState, useRef, useCallback } from "react";

import {
  makeInRect,
  makeSegmentCrossesRect,
} from "Features/annotations/utils/segmentCrossesRect";
import {
  getLassoMode,
  LASSO_MODE_CROSSING,
} from "Features/mapEditorGeneric/utils/lassoMode";

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

  const startLasso = useCallback((e) => {
    if (e.shiftKey && e.button === 0) {
      startScreenPosRef.current = { x: e.clientX, y: e.clientY };
      setLassoRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
      return true;
    }
    return false;
  }, []);

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
    // AutoCAD-like: left → right = WINDOW, right → left = CROSSING (see
    // lassoMode). Re-evaluated on every move.
    const mode = getLassoMode(startX, currentX);

    setLassoRect({ x, y, width, height, mode });
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

    const { mode } = lassoRect;
    const inRect = makeInRect(selectionBox);
    const inBox = (pt) => Boolean(pt) && inRect(pt);

    // Hit-test individual points (same rule in both modes).
    const points = getSelectedAnnotationPoints?.() || [];
    const hitPointIds = [];
    points.forEach((pt) => {
      if (inBox(pt)) hitPointIds.push(pt.id);
    });

    // Hit-test segments — WINDOW: both endpoints inside the rectangle;
    // CROSSING: an endpoint inside or the segment crossing a side.
    const segmentHit =
      mode === LASSO_MODE_CROSSING
        ? makeSegmentCrossesRect(selectionBox)
        : (p0, p1) => inBox(p0) && inBox(p1);
    const segments = getSelectedAnnotationSegments?.() || [];
    const hitPartIds = [];
    segments.forEach((seg) => {
      if (seg?.p0 && seg?.p1 && segmentHit(seg.p0, seg.p1)) {
        hitPartIds.push(seg.partId);
      }
    });

    // When the lasso caught no vertex and no segment of the selected
    // annotation, the caller should fall back to an annotation-level
    // multi-selection with the same rectangle (see InteractionLayer). So we
    // signal `empty` and hand back the selectionBox + screen anchor instead of
    // committing an (empty) point sub-selection.
    const empty = hitPointIds.length === 0 && hitPartIds.length === 0;
    const anchorPosition = { x: lassoRect.x, y: lassoRect.y };

    if (!empty && onSelectionComplete) {
      onSelectionComplete(hitPointIds, hitPartIds);
    }

    // Reset
    startScreenPosRef.current = null;
    setLassoRect(null);

    return { committed: true, empty, selectionBox, anchorPosition, mode };
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
