import { useRef, useState, useCallback } from "react";
import { useDispatch } from "react-redux";

import commitElevationOffsetService from "Features/elevation/services/commitElevationOffsetService";

// Vertical-only drag of an elevation handle (top or bottom of a vertex). X is
// fixed by the plan geometry; only Y (the Z value) is edited. Reuses the
// viewport's screenToWorld to map the cursor into the editor's SVG world space,
// then commits offsetTop / offsetBottom live on mouse up.
//
// Conversion (see useElevationProfile): worldY = -(z_m) * (1 / meterByPx)
//   => z_m = -worldY * meterByPx
//   TOP:    offsetTop    = z_m - height - offsetZ
//   BOTTOM: offsetBottom = z_m - offsetZ
export default function useElevationPointDrag({
  viewportRef,
  meterByPx,
  height,
  offsetZ,
  annotationId,
}) {
  const dispatch = useDispatch();

  const dragRef = useRef(null); // { pointIndex, edge, startClientY, moved }
  const [dragPreview, setDragPreview] = useState(null); // { pointIndex, edge, worldY }

  const worldYToValue = useCallback(
    (worldY, edge) => {
      const zM = -worldY * meterByPx;
      if (edge === "TOP") return zM - height - offsetZ;
      return zM - offsetZ;
    },
    [meterByPx, height, offsetZ]
  );

  const handleWindowMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || !viewportRef.current) return;
      if (Math.abs(e.clientY - drag.startClientY) > 3) drag.moved = true;
      const worldPos = viewportRef.current.screenToWorld(e.clientX, e.clientY);
      setDragPreview({
        pointIndex: drag.pointIndex,
        edge: drag.edge,
        worldY: worldPos.y,
      });
    },
    [viewportRef]
  );

  const handleWindowUp = useCallback(
    (e) => {
      window.removeEventListener("mousemove", handleWindowMove);
      window.removeEventListener("mouseup", handleWindowUp);

      const drag = dragRef.current;
      dragRef.current = null;
      setDragPreview(null);
      if (!drag || !drag.moved || !viewportRef.current) return;

      const worldPos = viewportRef.current.screenToWorld(e.clientX, e.clientY);
      const value = worldYToValue(worldPos.y, drag.edge);
      commitElevationOffsetService({
        annotationId,
        pointIndex: drag.pointIndex,
        edge: drag.edge,
        value,
        dispatch,
      });
    },
    [handleWindowMove, viewportRef, worldYToValue, annotationId, dispatch]
  );

  const startHandleDrag = useCallback(
    (e, pointIndex, edge) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        pointIndex,
        edge,
        startClientY: e.clientY,
        moved: false,
      };
      window.addEventListener("mousemove", handleWindowMove);
      window.addEventListener("mouseup", handleWindowUp);
    },
    [handleWindowMove, handleWindowUp]
  );

  return { startHandleDrag, dragPreview };
}
