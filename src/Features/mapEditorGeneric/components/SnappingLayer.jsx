// components/layers/SnappingLayer.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { Box } from "@mui/material";

import theme from "Styles/theme";

const SnappingLayer = forwardRef(({ color = "#ff00ff", isDrawing, onMouseDown }, ref) => {
    const circleRef = useRef(null);
    const rectRef = useRef(null);

    const radius = 6; // for circle
    const size = 10;  // for square (width/height)

    useImperativeHandle(ref, () => ({
        update: (pos) => {
            if (!circleRef.current || !rectRef.current) return;

            if (pos) {
                // pos contains { x, y, type } passed from InteractionLayer
                // type is usually 'VERTEX' or 'PROJECTION' (from getBestSnap)

                if (pos.type === 'VERTEX') {
                    // Show Circle, Hide Rect
                    circleRef.current.style.display = 'block';
                    circleRef.current.setAttribute('cx', pos.x);
                    circleRef.current.setAttribute('cy', pos.y);
                    rectRef.current.style.display = 'none';
                } else {
                    // Show Rect (Projection), Hide Circle
                    rectRef.current.style.display = 'block';
                    // Center the rectangle
                    rectRef.current.setAttribute('x', pos.x - size / 2);
                    rectRef.current.setAttribute('y', pos.y - size / 2);
                    circleRef.current.style.display = 'none';
                }
            } else {
                // Hide All
                circleRef.current.style.display = 'none';
                rectRef.current.style.display = 'none';
            }
        }
    }));

    const commonStyle = { cursor: "grab" };
    const eventHandlers = {
        onMouseDown: e => { if (onMouseDown) onMouseDown(e); }
    };

    return (
        <Box
            component="g"
            sx={{
                pointerEvents: 'auto',
                "& .vertex, & .projection": {
                    transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
                    strokeWidth: 2,
                    vectorEffect: "non-scaling-stroke",
                    cursor: "grab",
                },
                "& .vertex": {
                    stroke: theme.palette.anchor.active,

                }, "& .projection": {
                    stroke: theme.palette.anchor.passive,
                    ":hover": {
                        stroke: theme.palette.anchor.active
                    }
                }
            }}>
            {/* VERTEX SNAP MARKER */}
            <circle
                ref={circleRef}
                className="vertex"
                r={radius}
                fill="transparent"
                //style={{ ...commonStyle, display: 'none' }}
                {...eventHandlers}
            />

            {/* PROJECTION SNAP MARKER (Square) */}
            <rect
                ref={rectRef}
                className="projection"
                width={size}
                height={size}
                fill="transparent"
                //style={{ ...commonStyle, display: 'none' }}
                {...eventHandlers}
            />
        </Box>
    );
});

export default SnappingLayer;