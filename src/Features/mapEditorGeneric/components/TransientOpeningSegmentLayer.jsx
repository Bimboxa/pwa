import { forwardRef, useImperativeHandle, useState, useMemo } from "react";

// Transient preview of the opening segment while the OPENING_SEGMENT drawing
// mode is active: the band (real thickness), a dashed centerline and two
// counter-scaled jamb ticks at the endpoints. Driven imperatively from
// InteractionLayer's mouse-move via { update(state|null), clear() } with
// state = { p1, p2, bandWidthPx, fits, free, strokeColor, strokeOpacity }.

const INVALID_COLOR = "#ff9800";
const TICK_SIZE = 14;

const TransientOpeningSegmentLayer = forwardRef(({ containerK = 1 }, ref) => {
  const [state, setState] = useState(null);

  useImperativeHandle(ref, () => ({
    update: (newState) => setState(newState),
    clear: () => setState(null),
  }));

  const scaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  if (!state?.p1 || !state?.p2) return null;

  const { p1, p2, bandWidthPx, fits, free } = state;
  const invalid = fits === false;
  const color = invalid ? INVALID_COLOR : state.strokeColor || "#ff0000";
  const opacity = invalid ? 0.4 : (state.strokeOpacity ?? 0.8);

  const angleDeg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

  return (
    <g pointerEvents="none">
      {/* Band with real thickness */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        strokeWidth={Math.max(bandWidthPx || 0, 0.1)}
        strokeOpacity={opacity}
        strokeLinecap="butt"
      />

      {/* Dashed centerline (constant on-screen width) */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        strokeWidth={1}
        strokeDasharray={free ? "4 4" : "none"}
        vectorEffect="non-scaling-stroke"
      />

      {/* Jamb ticks, perpendicular to the segment, constant on-screen size */}
      {[p1, p2].map((p, i) => (
        <g
          key={i}
          style={{
            transform: `translate(${p.x}px, ${p.y}px) rotate(${angleDeg}deg) ${scaleTransform}`,
          }}
        >
          <line
            x1={0}
            y1={-TICK_SIZE / 2}
            x2={0}
            y2={TICK_SIZE / 2}
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </g>
  );
});

export default TransientOpeningSegmentLayer;
