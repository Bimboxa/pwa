import { forwardRef, useImperativeHandle, useRef } from "react";

const HALF_SIZE = 6; // screen px
const COLOR = "#ff00ff"; // same accent as the vertex snap marker

// Marker of the editor grid snap: a small cross on the grid line / node the
// point is snapping to. Lives in the staticOverlay of the viewport (screen
// px, zoom-independent), updated imperatively on mouse move — no React
// re-render. Never hit-tested: unlike the vertex snap marker, the snap is
// applied at commit whatever is clicked.
const GridSnapMarker = forwardRef((props, ref) => {
  const groupRef = useRef(null);

  useImperativeHandle(ref, () => ({
    // pos: { x, y } in viewport px, or null to hide
    update: (pos) => {
      const el = groupRef.current;
      if (!el) return;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
    },
  }));

  return (
    <g
      ref={groupRef}
      style={{ display: "none", pointerEvents: "none" }}
      stroke={COLOR}
      strokeWidth={1.5}
    >
      <line x1={-HALF_SIZE} y1={0} x2={HALF_SIZE} y2={0} />
      <line x1={0} y1={-HALF_SIZE} x2={0} y2={HALF_SIZE} />
    </g>
  );
});

GridSnapMarker.displayName = "GridSnapMarker";

export default GridSnapMarker;
