import { forwardRef, useImperativeHandle, useState } from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";

const flashAnimation = keyframes`
  0% { opacity: 0.4; stroke-width: 2px; }
  50% { opacity: 1; stroke-width: 3px; }
  100% { opacity: 0.4; stroke-width: 2px; }
`;

const COLOR = "#00ff00";

const AnimatedPolyline = styled.polyline`
  animation: ${flashAnimation} 1s infinite ease-in-out;
`;

const TransientDetectedPolylinesLayer = forwardRef((_, ref) => {
  const [polylines, setPolylines] = useState([]);

  useImperativeHandle(ref, () => ({
    updatePolylines: (newPolylines) => setPolylines(newPolylines || []),
    clear: () => setPolylines([]),
    getCount: () => polylines.length,
  }));

  if (polylines.length === 0) return null;

  return (
    <g>
      {polylines.map((polyline, i) => (
        <AnimatedPolyline
          key={i}
          points={polyline.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={COLOR}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          style={{ color: COLOR }}
        />
      ))}
      {/* Count badge — rendered at first polyline's start */}
      {polylines.length > 0 && polylines[0].length > 0 && (
        <text
          x={polylines[0][0].x}
          y={polylines[0][0].y - 10}
          fill={COLOR}
          fontSize="14"
          fontWeight="bold"
          pointerEvents="none"
          style={{
            paintOrder: "stroke",
            stroke: "rgba(0,0,0,0.7)",
            strokeWidth: 3,
            vectorEffect: "non-scaling-stroke",
          }}
        >
          {polylines.length} lines
        </text>
      )}
    </g>
  );
});

export default TransientDetectedPolylinesLayer;
