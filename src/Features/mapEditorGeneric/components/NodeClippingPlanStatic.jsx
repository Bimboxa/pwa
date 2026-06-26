import { useMemo } from "react";

// Transient "clipping plane" segment rendered on the baseMap (top view).
//
// Inspired by NodePolylineStatic but much simpler: a single 2-point segment
// with two draggable endpoints and two small direction arrows on either side
// (same logic as the observation arrows in PlanSelectorElevation). The segment
// is the intersection of a vertical 3D cutting plane with the top view; the
// filled arrow tells which way the plane cuts (sign +1 / -1).
//
// State is transient (redux only): endpoints come in resolved to image pixels;
// dragging reports back NORMALIZED [0..1] coords via onDragEndpoint, and arrow
// clicks report the sign via onSetSign.
export default function NodeClippingPlanStatic({
  pointA, // { x, y } in image px
  pointB, // { x, y } in image px
  sign = 1,
  containerK = 1, // basePose.k — used to keep handles/arrows a fixed screen size
  imageSize, // { width, height } — to normalize drag positions
  onSetSign,
  onDragEndpoint, // (which: "pointA" | "pointB", normPos: {x,y}) => void
}) {
  // helpers - fixed-on-screen sizes (image px = screen px / containerK)

  const k = containerK || 1;
  const HANDLE_R = 6 / k;
  const HANDLE_HIT_R = 13 / k;
  const STROKE_W = 2 / k;

  // helpers - two direction arrows on each side of the segment midpoint.
  // Geometry mirrors PlanSelectorElevation.observationArrows.

  const arrows = useMemo(() => {
    if (!pointA || !pointB) return null;
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const ARROW_PX = 12;
    const GAP_PX = 8;
    const size = ARROW_PX / k;
    const dist = size + GAP_PX / k;
    const cx = (pointA.x + pointB.x) / 2;
    const cy = (pointA.y + pointB.y) / 2;

    const make = (s) => {
      const ox = cx + nx * s * dist;
      const oy = cy + ny * s * dist;
      // arrow points toward the segment (inward = -n * s)
      const dirx = -nx * s;
      const diry = -ny * s;
      const tipx = ox + dirx * size;
      const tipy = oy + diry * size;
      const bx = ox - dirx * size * 0.4;
      const by = oy - diry * size * 0.4;
      const c1x = bx + ux * size * 0.7;
      const c1y = by + uy * size * 0.7;
      const c2x = bx - ux * size * 0.7;
      const c2y = by - uy * size * 0.7;
      return { sign: s, points: `${tipx},${tipy} ${c1x},${c1y} ${c2x},${c2y}` };
    };
    return [make(1), make(-1)];
  }, [pointA, pointB, k]);

  // handlers

  function handleEndpointMouseDown(which, e) {
    // Prevent MapEditorViewport from starting a pan (its onMouseDown bubbles
    // from the root svg). The InteractionLayer capture handler no-ops here.
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    const svg = el.ownerSVGElement;
    if (!svg || !imageSize) return;

    const move = (ev) => {
      // getScreenCTM maps the handle's user space (= image px, no local
      // transform on the handle) to screen; its inverse maps screen → image px,
      // robust to pan/zoom of the ancestor basePose group.
      const ctm = el.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const loc = pt.matrixTransform(ctm.inverse());
      onDragEndpoint?.(which, {
        x: loc.x / imageSize.width,
        y: loc.y / imageSize.height,
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  // render

  if (!pointA || !pointB) return null;

  return (
    <g className="clipping-plan-node">
      {/* segment line */}
      <line
        x1={pointA.x}
        y1={pointA.y}
        x2={pointB.x}
        y2={pointB.y}
        stroke="#ff9800"
        strokeWidth={STROKE_W}
        strokeDasharray={`${8 / k} ${5 / k}`}
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: "none" }}
      />

      {/* direction arrows */}
      {arrows?.map((arr) => (
        <polygon
          key={`clip-arrow-${arr.sign}`}
          points={arr.points}
          fill={arr.sign === sign ? "#76ff03" : "rgba(255,255,255,0.95)"}
          stroke="#5fae00"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: "pointer", pointerEvents: "auto" }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSetSign?.(arr.sign);
          }}
        />
      ))}

      {/* draggable endpoints */}
      {[
        ["pointA", pointA],
        ["pointB", pointB],
      ].map(([which, p]) => (
        <g key={which}>
          {/* hit area */}
          <circle
            cx={p.x}
            cy={p.y}
            r={HANDLE_HIT_R}
            fill="transparent"
            style={{ cursor: "move", pointerEvents: "auto" }}
            onMouseDown={(e) => handleEndpointMouseDown(which, e)}
          />
          {/* visible handle */}
          <circle
            cx={p.x}
            cy={p.y}
            r={HANDLE_R}
            fill="#fff"
            stroke="#ff9800"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />
        </g>
      ))}
    </g>
  );
}
