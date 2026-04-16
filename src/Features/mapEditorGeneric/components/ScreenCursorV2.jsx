// components/layers/ScreenCursor.jsx
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

const SPINNER_STYLE = `
@keyframes cursor-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

const ScreenCursorV2 = forwardRef(({ newAnnotation, visible, rotationAngle = 0 }, ref) => {
    const vLineRef = useRef(null);
    const hLineRef = useRef(null);
    const groupRef = useRef(null);
    const linesGroupRef = useRef(null);
    const spinnerRef = useRef(null);
    const zoomRectRef = useRef(null);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const zoomSquareSizeRef = useRef(0);
    const rotationAngleRef = useRef(rotationAngle);
    useEffect(() => { rotationAngleRef.current = rotationAngle; }, [rotationAngle]);

    const color = newAnnotation?.strokeColor ?? newAnnotation?.fillColor ?? "red";

    const updateZoomRect = (x, y) => {
        const rect = zoomRectRef.current;
        if (!rect) return;
        const size = zoomSquareSizeRef.current;
        rect.setAttribute('x', x - size / 2);
        rect.setAttribute('y', y - size / 2);
        rect.setAttribute('width', size);
        rect.setAttribute('height', size);
    };

    useImperativeHandle(ref, () => ({
        move: (x, y) => {
            lastPosRef.current = { x, y };
            if (!vLineRef.current || !hLineRef.current) return;
            vLineRef.current.setAttribute('x1', x);
            vLineRef.current.setAttribute('x2', x);
            hLineRef.current.setAttribute('y1', y);
            hLineRef.current.setAttribute('y2', y);
            // Rotate lines around cursor position
            if (linesGroupRef.current) {
                linesGroupRef.current.setAttribute('transform', `rotate(${-rotationAngleRef.current}, ${x}, ${y})`);
            }
            if (spinnerRef.current) {
                spinnerRef.current.setAttribute('cx', x);
                spinnerRef.current.setAttribute('cy', y);
            }
            updateZoomRect(x, y);
        },

        triggerFlash: () => {
            if (!groupRef.current) return;
            groupRef.current.animate([
                { stroke: 'white', strokeWidth: 4, strokeOpacity: 1 },
                { stroke: color, strokeWidth: 1, strokeOpacity: 0.8 }
            ], {
                duration: 300,
                easing: 'ease-out'
            });
        },

        showSpinner: () => {
            if (spinnerRef.current) {
                spinnerRef.current.style.display = '';
            }
        },

        hideSpinner: () => {
            if (spinnerRef.current) {
                spinnerRef.current.style.display = 'none';
            }
        },

        setZoomSquareSize: (size) => {
            zoomSquareSizeRef.current = size;
            updateZoomRect(lastPosRef.current.x, lastPosRef.current.y);
        },

        showZoomSquare: () => {
            if (zoomRectRef.current) zoomRectRef.current.style.display = '';
        },

        hideZoomSquare: () => {
            if (zoomRectRef.current) zoomRectRef.current.style.display = 'none';
        },
    }));

    if (!visible) return null;

    return (
        <g
            ref={groupRef}
            style={{ pointerEvents: 'none' }}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="4,2"
            strokeOpacity={0.8}
        >
            <style>{SPINNER_STYLE}</style>
            <g ref={linesGroupRef}>
                <line
                    ref={vLineRef}
                    y1="0"
                    y2="100%"
                    vectorEffect="non-scaling-stroke"
                />
                <line
                    ref={hLineRef}
                    x1="0"
                    x2="100%"
                    vectorEffect="non-scaling-stroke"
                />
            </g>
            <circle
                ref={spinnerRef}
                cx={0}
                cy={0}
                r="12"
                fill="none"
                stroke="#00ff00"
                strokeWidth="2.5"
                strokeDasharray="20,12"
                strokeLinecap="round"
                strokeOpacity={1}
                vectorEffect="non-scaling-stroke"
                style={{
                    display: 'none',
                    animation: 'cursor-spin 0.8s linear infinite',
                    transformOrigin: 'center',
                    transformBox: 'fill-box',
                }}
            />
            <rect
                ref={zoomRectRef}
                x={0}
                y={0}
                width={0}
                height={0}
                fill="none"
                stroke="#00ff00"
                strokeWidth="1.5"
                strokeDasharray="6,3"
                strokeOpacity={0.8}
                vectorEffect="non-scaling-stroke"
                style={{ display: 'none' }}
            />
        </g>
    );
});

export default ScreenCursorV2;