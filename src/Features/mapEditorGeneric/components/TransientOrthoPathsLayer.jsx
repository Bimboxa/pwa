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

const TransientOrthoPathsLayer = forwardRef((_, ref) => {
  const [paths, setPaths] = useState([]);

  useImperativeHandle(ref, () => ({
    updatePaths: (newPaths) => setPaths(newPaths || []),
    clear: () => setPaths([]),
  }));

  if (paths.length === 0) return null;

  return (
    <g>
      {paths.map((polyline, i) => (
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
    </g>
  );
});

export default TransientOrthoPathsLayer;
