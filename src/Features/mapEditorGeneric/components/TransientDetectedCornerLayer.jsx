import { forwardRef, useImperativeHandle, useState, useMemo } from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";

// Keyframes for the flashing effect
const flash = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.3; }
  100% { opacity: 1; }
`;

// Styled group for animation
const FlashingGroup = styled.g`
  animation: ${flash} 1s linear infinite;
`;

const TransientDetectedCornerLayer = forwardRef(({ size = 24, containerK = 1 }, ref) => {
    const [cornerPoint, setCornerPoint] = useState(null);

    useImperativeHandle(ref, () => ({
        updateCorner: (point) => {
            setCornerPoint(point);
        }
    }));

    const halfSize = size / 2

    // scale

    const scaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);


    // render

    if (!cornerPoint) return null;

    return (
        <FlashingGroup
            style={{
                transform: `translate(${cornerPoint.x}px, ${cornerPoint.y}px) ${scaleTransform}`
            }}
        >
            <line
                x1={-halfSize}
                y1={0}
                x2={halfSize}
                y2={0}
                stroke="#00ff00"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
            />
            <line
                x1={0}
                y1={-halfSize}
                x2={0}
                y2={halfSize}
                stroke="#00ff00"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
            />
        </FlashingGroup>
    );
});

export default TransientDetectedCornerLayer;
