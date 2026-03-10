import { useState, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { setVersionTransformOverride } from "Features/baseMapEditor/baseMapEditorSlice";
import db from "App/db/db";

/**
 * Hook that manages version image drag (move and resize) within the basePose group.
 *
 * Transforms are in reference pixel space (relative to refWidth/refHeight).
 * During drag, dispatches the in-progress transform to Redux for live rendering.
 */
export default function useVersionDrag({ basePose, viewportRef }) {
  const dispatch = useDispatch();

  // state

  const [versionDragState, setVersionDragState] = useState(null);
  const rafRef = useRef(null);
  const lastTransformRef = useRef(null);

  // refs for synchronous access

  const basePoseRef = useRef(basePose);
  basePoseRef.current = basePose;

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // helpers

  const toLocal = useCallback((worldPos) => {
    const bp = basePoseRef.current;
    return {
      x: (worldPos.x - bp.x) / bp.k,
      y: (worldPos.y - bp.y) / bp.k,
    };
  }, []);

  // init

  const initVersionDrag = useCallback(
    (versionId, handleType, e, startTransform, imageSize, baseMapId) => {
      const startMouseWorld = viewportRef.current?.screenToWorld(
        e.clientX,
        e.clientY
      );
      if (!startMouseWorld) return;

      const startMouseLocal = toLocal(startMouseWorld);
      const transform = { ...startTransform };

      lastTransformRef.current = transform;

      setVersionDragState({
        active: true,
        versionId,
        baseMapId,
        handleType,
        startMouseLocal,
        startTransform: transform,
        imageSize,
      });

      dispatchRef.current(
        setVersionTransformOverride({ versionId, transform })
      );

      document.body.style.cursor =
        handleType === "MOVE" ? "grabbing" : "crosshair";
    },
    [viewportRef, toLocal]
  );

  // move

  const handleVersionDragMove = useCallback(
    (worldPos) => {
      if (!versionDragState?.active) return false;

      const { startMouseLocal, startTransform, handleType, imageSize } =
        versionDragState;

      const currentLocal = toLocal(worldPos);
      const dx = currentLocal.x - startMouseLocal.x;
      const dy = currentLocal.y - startMouseLocal.y;

      let newTransform = { ...startTransform };

      if (handleType === "MOVE") {
        newTransform.x = startTransform.x + dx;
        newTransform.y = startTransform.y + dy;
      } else if (["SE", "SW", "NE", "NW"].includes(handleType)) {
        if (imageSize?.width && imageSize?.height) {
          const w = imageSize.width;
          const h = imageSize.height;

          let deltaK = 0;
          if (handleType.includes("E")) {
            deltaK = dx / w;
          } else {
            deltaK = -dx / w;
          }

          const newScale = Math.max(
            0.001,
            (startTransform.scale || 1) + deltaK
          );
          newTransform.scale = newScale;

          const kDiff = newScale - (startTransform.scale || 1);
          const widthChange = w * kDiff;
          const heightChange = h * kDiff;

          if (handleType.includes("W")) {
            newTransform.x = startTransform.x - widthChange;
          }
          if (handleType.includes("N")) {
            newTransform.y = startTransform.y - heightChange;
          }
        }
      }

      lastTransformRef.current = newTransform;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        dispatchRef.current(
          setVersionTransformOverride({
            versionId: versionDragState.versionId,
            transform: newTransform,
          })
        );
        rafRef.current = null;
      });

      return true;
    },
    [versionDragState, toLocal]
  );

  // end

  const handleVersionDragEnd = useCallback(async () => {
    if (!versionDragState?.active) return false;

    const { versionId, baseMapId } = versionDragState;
    const finalTransform = lastTransformRef.current;

    // Clear Redux override
    dispatchRef.current(setVersionTransformOverride(null));

    // Persist to DB
    if (baseMapId && versionId && finalTransform) {
      await db.baseMapVersions.update(versionId, { transform: finalTransform });
    }

    lastTransformRef.current = null;
    setVersionDragState(null);
    document.body.style.cursor = "";
    return true;
  }, [versionDragState]);

  return {
    versionDragState,
    initVersionDrag,
    handleVersionDragMove,
    handleVersionDragEnd,
  };
}
