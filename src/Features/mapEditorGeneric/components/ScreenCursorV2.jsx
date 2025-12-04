// components/layers/ScreenCursor.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

const ScreenCursorV2 = forwardRef(({ newAnnotation, visible }, ref) => {
    const vLineRef = useRef(null);
    const hLineRef = useRef(null);
    const groupRef = useRef(null);

    const color = newAnnotation?.strokeColor ?? newAnnotation?.fillColor ?? "red";

    useImperativeHandle(ref, () => ({
        move: (x, y) => {
            if (!vLineRef.current || !hLineRef.current) return;
            vLineRef.current.setAttribute('x1', x);
            vLineRef.current.setAttribute('x2', x);
            hLineRef.current.setAttribute('y1', y);
            hLineRef.current.setAttribute('y2', y);
        },

        triggerFlash: () => {
            if (!groupRef.current) return;

            // L'animation fonctionne maintenant car les enfants n'ont plus de stroke fixe
            groupRef.current.animate([
                { stroke: 'white', strokeWidth: 4, strokeOpacity: 1 }, // Flash brillant
                { stroke: color, strokeWidth: 1, strokeOpacity: 0.8 }  // Retour à la normale
            ], {
                duration: 300,
                easing: 'ease-out'
            });
        }
    }));

    if (!visible) return null;

    return (
        <g
            ref={groupRef}
            style={{ pointerEvents: 'none' }}
            // --- CORRECTION ICI ---
            // On définit les styles par défaut sur le PARENT
            stroke={color}
            strokeWidth={1}
            strokeDasharray="4,2"
            strokeOpacity={0.8}
        >
            <line
                ref={vLineRef}
                y1="0"
                y2="100%"
                // On garde vectorEffect ici car il ne s'hérite pas toujours bien
                vectorEffect="non-scaling-stroke"
            />
            <line
                ref={hLineRef}
                x1="0"
                x2="100%"
                vectorEffect="non-scaling-stroke"
            />
        </g>
    );
});

export default ScreenCursorV2;