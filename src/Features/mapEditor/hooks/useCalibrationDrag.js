import { useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCalibrationTargets } from "Features/baseMapEditor/baseMapEditorSlice";

const DEFAULT_RED = { x: 0.1, y: 0.1 };
const DEFAULT_GREEN = { x: 0.9, y: 0.9 };

/**
 * Hook that manages drag of calibration targets (red/green).
 * Targets are stored as relative positions in the image reference space, per active version.
 * No clamping: targets can be placed outside image bounds.
 */
// Injected style element to force cursor during drag
let dragStyleEl = null;
function setDragCursor(cursor) {
  if (!dragStyleEl) {
    dragStyleEl = document.createElement("style");
    document.head.appendChild(dragStyleEl);
  }
  dragStyleEl.textContent = `* { cursor: ${cursor} !important; }`;
}
function clearDragCursor() {
  if (dragStyleEl) {
    dragStyleEl.remove();
    dragStyleEl = null;
  }
}

export default function useCalibrationDrag({ basePose, viewportRef, baseMap }) {
  const dispatch = useDispatch();

  // state

  const [calibrationDragState, setCalibrationDragState] = useState(null);
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );

  // refs

  const basePoseRef = useRef(basePose);
  basePoseRef.current = basePose;

  const targetsRef = useRef(calibrationTargetsByVersionId);
  targetsRef.current = calibrationTargetsByVersionId;

  // helpers

  const toLocal = useCallback((worldPos) => {
    const bp = basePoseRef.current;
    return {
      x: (worldPos.x - bp.x) / bp.k,
      y: (worldPos.y - bp.y) / bp.k,
    };
  }, []);

  // init

  const initCalibrationDrag = useCallback(
    (targetColor, e) => {
      const startMouseWorld = viewportRef.current?.screenToWorld(
        e.clientX,
        e.clientY
      );
      if (!startMouseWorld) return;
      if (!baseMap) return;

      const activeVersion = baseMap.getActiveVersion();
      if (!activeVersion) return;

      const versionId = activeVersion.id;
      const currentTargets = targetsRef.current[versionId] || {
        red: DEFAULT_RED,
        green: DEFAULT_GREEN,
      };

      setCalibrationDragState({
        active: true,
        targetColor,
        versionId,
        currentTargets,
      });

      setDragCursor("crosshair");
    },
    [viewportRef, baseMap]
  );

  // move

  const handleCalibrationDragMove = useCallback(
    (worldPos) => {
      if (!calibrationDragState?.active) return false;
      if (!baseMap) return false;

      const imageSize = baseMap.getImageSize();
      if (!imageSize) return false;

      const currentLocal = toLocal(worldPos);

      // Convert to relative (no clamping — target may need to be outside image bounds)
      const relX = currentLocal.x / imageSize.width;
      const relY = currentLocal.y / imageSize.height;

      const { targetColor, versionId, currentTargets } = calibrationDragState;

      const newTargets = {
        ...currentTargets,
        [targetColor]: { x: relX, y: relY },
      };

      setCalibrationDragState((prev) => ({
        ...prev,
        currentTargets: newTargets,
      }));

      dispatch(setCalibrationTargets({ versionId, ...newTargets }));

      return true;
    },
    [calibrationDragState, baseMap, toLocal, dispatch]
  );

  // end

  const handleCalibrationDragEnd = useCallback(() => {
    if (!calibrationDragState?.active) return false;
    setCalibrationDragState(null);
    clearDragCursor();
    return true;
  }, [calibrationDragState]);

  return {
    calibrationDragState,
    initCalibrationDrag,
    handleCalibrationDragMove,
    handleCalibrationDragEnd,
  };
}
