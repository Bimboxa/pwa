import { useRef, useCallback } from "react";
import { useDispatch } from "react-redux";

import { updateMeshLine, setSelectedLineId } from "Features/mesh/meshSlice";

import { segmentNormal } from "Features/mesh/utils/meshGeometry";

// Drag interactions for a cut line, in the editor's world space:
//   - mode "P1" / "P2": move a single endpoint freely (can make the line
//     oblique).
//   - mode "BODY": translate the whole segment along its normal (the cursor
//     delta is projected onto the line normal, so the line slides
//     perpendicular to itself).
//
// Updates are dispatched live so the cell surfaces recompute in real time.
export default function useMeshLineDrag({ viewportRef }) {
  const dispatch = useDispatch();
  const dragRef = useRef(null);

  const handleWindowMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || !viewportRef.current) return;
      const world = viewportRef.current.screenToWorld(e.clientX, e.clientY);

      if (drag.mode === "P1") {
        dispatch(updateMeshLine({ id: drag.lineId, p1: world }));
      } else if (drag.mode === "P2") {
        dispatch(updateMeshLine({ id: drag.lineId, p2: world }));
      } else {
        // BODY: translate along the normal
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        const proj = dx * drag.normal.x + dy * drag.normal.y;
        dispatch(
          updateMeshLine({
            id: drag.lineId,
            p1: {
              x: drag.startP1.x + drag.normal.x * proj,
              y: drag.startP1.y + drag.normal.y * proj,
            },
            p2: {
              x: drag.startP2.x + drag.normal.x * proj,
              y: drag.startP2.y + drag.normal.y * proj,
            },
          })
        );
      }
    },
    [viewportRef, dispatch]
  );

  const handleWindowUp = useCallback(() => {
    window.removeEventListener("mousemove", handleWindowMove);
    window.removeEventListener("mouseup", handleWindowUp);
    dragRef.current = null;
  }, [handleWindowMove]);

  const startLineDrag = useCallback(
    (e, line, mode) => {
      e.stopPropagation();
      e.preventDefault();
      if (!viewportRef.current) return;
      const startWorld = viewportRef.current.screenToWorld(
        e.clientX,
        e.clientY
      );
      dragRef.current = {
        lineId: line.id,
        mode,
        startWorld,
        startP1: { ...line.p1 },
        startP2: { ...line.p2 },
        normal: segmentNormal(line.p1, line.p2),
      };
      dispatch(setSelectedLineId(line.id));
      window.addEventListener("mousemove", handleWindowMove);
      window.addEventListener("mouseup", handleWindowUp);
    },
    [viewportRef, dispatch, handleWindowMove, handleWindowUp]
  );

  return { startLineDrag };
}
