// components/DrawingLayer.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

const DrawingLayer = forwardRef(({
    points, newAnnotation,
    onHoverFirstPoint, onLeaveFirstPoint
}, ref) => {
    const previewLineRef = useRef(null);
    const previewFillRef = useRef(null); // <--- NEW: For the polygon surface

    const { strokeColor, fillColor, type, closeLine } = newAnnotation || {};
    const isPolygon = type === "POLYGON" || closeLine;
    const firstPoint = points?.[0];

    useImperativeHandle(ref, () => ({
        updatePreview: (cursorPos) => {
            if (points.length === 0) return;

            const lastPoint = points[points.length - 1];

            // 1. Update Rubber Band Line (Existing)
            if (previewLineRef.current) {
                previewLineRef.current.setAttribute('x1', lastPoint.x);
                previewLineRef.current.setAttribute('y1', lastPoint.y);
                previewLineRef.current.setAttribute('x2', cursorPos.x);
                previewLineRef.current.setAttribute('y2', cursorPos.y);
                previewLineRef.current.style.display = 'block';
            }

            // 2. Update Polygon Fill (NEW)
            if (isPolygon && previewFillRef.current) {
                // Construct path: Start -> ...Points -> Cursor -> Start (Z)
                const staticPart = points.map(p => `${p.x} ${p.y}`).join(' L ');
                const d = `M ${staticPart} L ${cursorPos.x} ${cursorPos.y} Z`;

                previewFillRef.current.setAttribute('d', d);
                previewFillRef.current.style.display = 'block';
            }
        },
        clearPreview: () => {
            if (previewLineRef.current) previewLineRef.current.style.display = 'none';
            if (previewFillRef.current) previewFillRef.current.style.display = 'none';
        }
    }));

    // Static path construction
    const staticPath = points.length > 1
        ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`
        : '';

    return (
        <g className="drawing-layer">

            {/* A. Dynamic Fill (Polygon Only) - Rendered FIRST to be behind */}
            {isPolygon && (
                <path
                    ref={previewFillRef}
                    fill={fillColor || "rgba(0, 0, 255, 0.1)"}
                    fillRule="evenodd"
                    stroke="none"
                    style={{ display: 'none', pointerEvents: 'none' }}
                />
            )}

            {/* B. Static Stroke */}
            <path
                d={staticPath}
                stroke={strokeColor || "blue"}
                strokeWidth={2}
                fill="none"
                vectorEffect="non-scaling-stroke"
            />

            {/* C. Vertices */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={strokeColor || "blue"} vectorEffect="non-scaling-stroke" />
            ))}

            {/* ZONE DE DÉTECTION "CLOSING" (Uniquement pour le premier point d'un polygone) */}
            {isPolygon && firstPoint && points.length >= 3 && (
                <circle
                    cx={firstPoint.x}
                    cy={firstPoint.y}
                    r={10} // Rayon visuel (ou invisible)

                    // STYLE MAGIQUE POUR LE HIT-TESTING
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={20} // Zone de clic large (20px)
                    vectorEffect="non-scaling-stroke" // Reste 20px écran peu importe le zoom !

                    style={{ cursor: 'pointer', pointerEvents: 'all' }}

                    // Événements DOM natifs
                    onMouseEnter={() => onHoverFirstPoint && onHoverFirstPoint(firstPoint)}
                    onMouseLeave={() => onLeaveFirstPoint && onLeaveFirstPoint()}
                />
            )}

            {/* D. Dynamic Rubber Band */}
            <line
                ref={previewLineRef}
                stroke={strokeColor || "blue"}
                strokeWidth={1}
                strokeDasharray="5,5"
                vectorEffect="non-scaling-stroke"
                style={{ display: 'none', pointerEvents: 'none' }}
            />
        </g>
    );
});

export default DrawingLayer;