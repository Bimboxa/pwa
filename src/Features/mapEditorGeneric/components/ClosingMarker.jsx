// components/layers/ClosingMarker.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import theme from "Styles/theme";

const ClosingMarker = forwardRef(({ onClick, color = "green" }, ref) => {
    const circleRef = useRef(null);

    useImperativeHandle(ref, () => ({
        update: (pos) => {
            if (!circleRef.current) return;
            if (pos) {
                circleRef.current.style.display = 'block';
                circleRef.current.setAttribute('cx', pos.x);
                circleRef.current.setAttribute('cy', pos.y);
            } else {
                circleRef.current.style.display = 'none';
            }
        }
    }));

    return (
        <g style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
            <circle
                ref={circleRef}
                r={6} // Fixed 6px radius (12px size)
                fill="transparent"
                stroke={color}
                strokeWidth={2}
                style={{ display: 'none' }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onClick && onClick();
                }}
            />
        </g>
    );
});

export default ClosingMarker;