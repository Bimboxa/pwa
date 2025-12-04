// components/DrawingLayer.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

const DrawingLayer = forwardRef(({ points, color = "blue", newAnnotation }, ref) => {
    const previewLineRef = useRef(null);

    // data

    const { strokeColor, fillColor, type } = newAnnotation;

    // 1. Exposer une commande directe pour modifier le DOM (Performance Max)
    useImperativeHandle(ref, () => ({
        updatePreview: (cursorPos) => {
            if (!previewLineRef.current || points.length === 0) return;

            const lastPoint = points[points.length - 1];

            // On modifie directement les attributs SVG du trait fantôme
            previewLineRef.current.setAttribute('x1', lastPoint.x);
            previewLineRef.current.setAttribute('y1', lastPoint.y);
            previewLineRef.current.setAttribute('x2', cursorPos.x);
            previewLineRef.current.setAttribute('y2', cursorPos.y);

            // Optionnel : Rendre visible si caché
            previewLineRef.current.style.display = 'block';
        },
        clearPreview: () => {
            if (previewLineRef.current) previewLineRef.current.style.display = 'none';
        }
    }));

    // 2. Générer le path statique (les points déjà cliqués)
    // "M x y L x y ..."
    const staticPath = points.length > 1
        ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`
        : '';

    return (
        <g className="drawing-layer">
            {/* A. La partie validée (Statique) */}
            <path
                d={staticPath}
                stroke={strokeColor}
                strokeWidth={2}
                fill="none"
                vectorEffect="non-scaling-stroke" // Important pour le zoom
            />

            {/* B. Les sommets validés (Petits ronds) */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} vectorEffect="non-scaling-stroke" />
            ))}

            {/* C. Le trait fantôme (Dynamique via Ref) */}
            <line
                ref={previewLineRef}
                stroke={strokeColor}
                strokeWidth={1}
                strokeDasharray="5,5" // Pointillés pour dire "en cours"
                vectorEffect="non-scaling-stroke"
                style={{ display: 'none', pointerEvents: 'none' }}
            />
        </g>
    );
});

export default DrawingLayer;