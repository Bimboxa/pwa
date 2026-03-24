// components/layers/ClosingMarker.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import theme from "Styles/theme";

const HOVER_COLOR = "#FF00FF";

const ClosingMarker = forwardRef(({ onClick, color = "green" }, ref) => {
    const groupRef = useRef(null);
    const circleRef = useRef(null);

    useImperativeHandle(ref, () => ({
        update: (pos) => {
            if (!groupRef.current) return;
            if (pos) {
                groupRef.current.style.display = 'block';
                groupRef.current.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
            } else {
                groupRef.current.style.display = 'none';
                // Reset hover state when hidden
                if (circleRef.current) {
                    circleRef.current.setAttribute('stroke', color);
                    circleRef.current.setAttribute('fill', 'transparent');
                }
            }
        }
    }));

    const handleMouseEnter = () => {
        if (!circleRef.current) return;
        circleRef.current.setAttribute('stroke', HOVER_COLOR);
        circleRef.current.setAttribute('fill', HOVER_COLOR);
        circleRef.current.setAttribute('fill-opacity', '0.3');
    };

    const handleMouseLeave = () => {
        if (!circleRef.current) return;
        circleRef.current.setAttribute('stroke', color);
        circleRef.current.setAttribute('fill', 'transparent');
        circleRef.current.removeAttribute('fill-opacity');
    };

    const handleMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick && onClick();
    };

    return (
        <g
            ref={groupRef}
            style={{ display: 'none', cursor: 'pointer', pointerEvents: 'auto' }}
        >
            {/* Large invisible hit area for reliable hover/click detection */}
            <circle
                r={14}
                fill="transparent"
                stroke="transparent"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
            />
            {/* Visible marker */}
            <circle
                ref={circleRef}
                r={6}
                fill="transparent"
                stroke={color}
                strokeWidth={2}
                style={{ pointerEvents: 'none' }}
            />
        </g>
    );
});

export default ClosingMarker;
