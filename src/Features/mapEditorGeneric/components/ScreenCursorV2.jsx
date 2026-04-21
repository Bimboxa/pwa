// components/layers/ScreenCursor.jsx
import React, { forwardRef, useImperativeHandle, useRef, useEffect, useId } from 'react';

const SPINNER_STYLE = `
@keyframes cursor-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

const ScreenCursorV2 = forwardRef(({ newAnnotation, visible, rotationAngle = 0, crosshairAxis = "BOTH", showZoomRect = false }, ref) => {
    const vLineRef = useRef(null);
    const hLineRef = useRef(null);
    const groupRef = useRef(null);
    const linesGroupRef = useRef(null);
    const spinnerRef = useRef(null);
    const zoomRectRef = useRef(null);
    // Dim overlay pieces — dim the map outside the zoom rect to spotlight the ROI.
    const dimGroupRef = useRef(null);
    const maskHoleRef = useRef(null);
    const lastPosRef = useRef({ x: 0, y: 0 });
    const zoomRectSizeRef = useRef({ width: 0, height: 0 });
    const rotationAngleRef = useRef(rotationAngle);
    useEffect(() => { rotationAngleRef.current = rotationAngle; }, [rotationAngle]);

    // Unique mask id per instance — lets multiple ScreenCursors coexist on
    // the same page without stomping on each other's masks.
    const uid = useId().replace(/:/g, "-");
    const maskId = `screen-cursor-zoom-mask-${uid}`;

    const color = newAnnotation?.strokeColor ?? newAnnotation?.fillColor ?? "red";

    const updateZoomRect = (x, y) => {
        const { width, height } = zoomRectSizeRef.current;
        const rect = zoomRectRef.current;
        if (rect) {
            rect.setAttribute('x', x - width / 2);
            rect.setAttribute('y', y - height / 2);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
        }
        // Keep the dim-mask hole in sync with the visible zoom rect.
        // The hole must also rotate by the same ortho angle as linesGroupRef
        // (which wraps the visible zoom rect) so the dimmed silhouette
        // matches the detection ROI when orthoSnapAngleOffset != 0.
        const hole = maskHoleRef.current;
        if (hole) {
            hole.setAttribute('x', x - width / 2);
            hole.setAttribute('y', y - height / 2);
            hole.setAttribute('width', width);
            hole.setAttribute('height', height);
            const angle = rotationAngleRef.current || 0;
            if (angle) {
                hole.setAttribute('transform', `rotate(${-angle}, ${x}, ${y})`);
            } else {
                hole.removeAttribute('transform');
            }
        }
        // Hide the dim group entirely when no zoom rect is active (size 0).
        const dim = dimGroupRef.current;
        if (dim) {
            dim.style.display = width > 0 && height > 0 ? '' : 'none';
        }
    };

    useImperativeHandle(ref, () => ({
        move: (x, y) => {
            lastPosRef.current = { x, y };
            if (vLineRef.current) {
                vLineRef.current.setAttribute('x1', x);
                vLineRef.current.setAttribute('x2', x);
            }
            if (hLineRef.current) {
                hLineRef.current.setAttribute('y1', y);
                hLineRef.current.setAttribute('y2', y);
            }
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
            // Accept both legacy scalar and new {width, height}
            const s = typeof size === "number" ? { width: size, height: size } : size;
            zoomRectSizeRef.current = s;
            updateZoomRect(lastPosRef.current.x, lastPosRef.current.y);
        },

        showZoomSquare: () => {},
        hideZoomSquare: () => {},
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

            {/* Dim overlay — paints a translucent gray over the whole viewport
                except for the zoom square, visually spotlighting the ROI
                where smart detection will run. Kept outside the rotated
                crosshair group so screen-axis coverage stays intact. */}
            {showZoomRect && (
                <g ref={dimGroupRef} style={{ display: 'none' }}>
                    <defs>
                        <mask id={maskId}>
                            <rect x="0" y="0" width="100%" height="100%" fill="white" />
                            <rect ref={maskHoleRef} x={0} y={0} width={0} height={0} fill="black" />
                        </mask>
                    </defs>
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill="rgba(0,0,0,0.35)"
                        mask={`url(#${maskId})`}
                        stroke="none"
                    />
                </g>
            )}

            <g ref={linesGroupRef}>
                {(crosshairAxis === "BOTH" || crosshairAxis === "V") && (
                    <line
                        ref={vLineRef}
                        y1="0"
                        y2="100%"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                {(crosshairAxis === "BOTH" || crosshairAxis === "H") && (
                    <line
                        ref={hLineRef}
                        x1="0"
                        x2="100%"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                {/* Zoom square — sits inside the rotated group so its sides
                    stay aligned with the ortho axes. */}
                {showZoomRect && (
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
                    />
                )}
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
        </g>
    );
});

export default ScreenCursorV2;