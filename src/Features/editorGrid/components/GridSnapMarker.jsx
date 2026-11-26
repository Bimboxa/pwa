import { forwardRef, useImperativeHandle, useRef } from "react";

import { useSelector } from "react-redux";

const BASE_RADIUS = 6; // screen px, same as the vertex snap marker
const COLOR = "#ff00ff"; // same accent as the vertex snap marker

// Marker of the editor grid snap: the same ring as the vertex snap marker
// (SnappingLayer), around the grid node the point is snapping to. Lives in
// the staticOverlay of the viewport (screen px, zoom-independent), updated
// imperatively on mouse move — no React re-render. Never hit-tested: unlike
// the vertex snap marker, the snap is applied at commit whatever is clicked.
const GridSnapMarker = forwardRef((props, ref) => {
  // data

  // same size rule as SnappingLayer: follows the vertex handle size setting
  const vertexSizeMultiplier =
    useSelector((s) => s.mapEditor.vertexSizeMultiplier) || 1;

  // state

  const circleRef = useRef(null);

  useImperativeHandle(ref, () => ({
    // pos: { x, y } in viewport px, or null to hide
    update: (pos) => {
      const el = circleRef.current;
      if (!el) return;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.setAttribute("cx", pos.x);
      el.setAttribute("cy", pos.y);
    },
  }));

  // render

  return (
    <circle
      ref={circleRef}
      r={BASE_RADIUS * vertexSizeMultiplier}
      style={{ display: "none", pointerEvents: "none" }}
      fill="transparent"
      stroke={COLOR}
      strokeWidth={2}
    />
  );
});

GridSnapMarker.displayName = "GridSnapMarker";

export default GridSnapMarker;
