import { forwardRef, useImperativeHandle, useState } from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";

const flashAnimation = keyframes`
  0% { opacity: 0.35; }
  50% { opacity: 0.85; }
  100% { opacity: 0.35; }
`;

const COLOR = "#00ff00";

const AnimatedG = styled.g`
  animation: ${flashAnimation} 1s infinite ease-in-out;
`;

/**
 * Flashing green ghost copies of the copied annotation, one per detected
 * pattern match. Coordinates are in REFERENCE space (same as the paste
 * preview), so this is mounted inside the map transform group.
 *
 * Match shape: { polylines: [{ points:[{x,y}], closed }], point?: {x,y} }
 *
 * Imperative API: updateMatches(matches) / clear() / getCount()
 */
const TransientDetectedPatternLayer = forwardRef(({ containerK = 1 }, ref) => {
  const [matches, setMatches] = useState([]);

  useImperativeHandle(ref, () => ({
    updateMatches: (next) => setMatches(next || []),
    clear: () => setMatches([]),
    getCount: () => matches.length,
  }));

  if (!matches.length) return null;

  const pointR = 6 / (containerK || 1);
  const toAttr = (pts) => pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <AnimatedG pointerEvents="none">
      {matches.map((m, i) => (
        <g key={i}>
          {(m.polylines || []).map((pl, j) => {
            if (!pl.points || pl.points.length < 2) return null;
            const common = {
              points: toAttr(pl.points),
              stroke: COLOR,
              strokeWidth: 3,
              vectorEffect: "non-scaling-stroke",
              pointerEvents: "none",
            };
            return pl.closed ? (
              <polygon
                key={j}
                {...common}
                fill={COLOR}
                fillOpacity={0.25}
                fillRule="evenodd"
              />
            ) : (
              <polyline key={j} {...common} fill="none" />
            );
          })}
          {m.point && (
            <g>
              <circle
                cx={m.point.x}
                cy={m.point.y}
                r={pointR}
                fill={COLOR}
                fillOpacity={0.4}
                stroke={COLOR}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            </g>
          )}
        </g>
      ))}
    </AnimatedG>
  );
});

export default TransientDetectedPatternLayer;
