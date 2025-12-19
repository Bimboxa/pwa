// components/DrawingLayer.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

const DrawingLayer = forwardRef(({
    points,
    newAnnotation,
    enabledDrawingMode, // <--- NOUVELLE PROP
    onHoverFirstPoint,
    onLeaveFirstPoint
}, ref) => {


    // Refs pour l'accès DOM direct (Performance)
    const previewLineRef = useRef(null);
    const previewFillRef = useRef(null);
    const previewRectRef = useRef(null); // <--- NOUVELLE REF

    const { strokeColor, fillColor, type } = newAnnotation || {};

    // Détection des types
    const isPolygon = type === "POLYGON";
    const drawRectangle = enabledDrawingMode === "RECTANGLE";

    const firstPoint = points?.[0];

    useImperativeHandle(ref, () => ({
        updatePreview: (cursorPos) => {
            // S'il n'y a pas encore de point posé, on ne dessine rien
            if (points.length === 0) return;

            const lastPoint = points[points.length - 1];

            // ------------------------------------------------
            // CAS 1 : RECTANGLE (1er point fixe -> Curseur)
            // ------------------------------------------------
            if (drawRectangle && previewRectRef.current) {
                // On cache les éléments inutiles pour ce mode
                if (previewLineRef.current) previewLineRef.current.style.display = 'none';
                if (previewFillRef.current) previewFillRef.current.style.display = 'none';

                // Calcul de la géométrie du rectangle
                // SVG demande x, y (coin haut-gauche) + width, height (positifs)
                const x = Math.min(lastPoint.x, cursorPos.x);
                const y = Math.min(lastPoint.y, cursorPos.y);
                const width = Math.abs(cursorPos.x - lastPoint.x);
                const height = Math.abs(cursorPos.y - lastPoint.y);

                previewRectRef.current.setAttribute('x', x);
                previewRectRef.current.setAttribute('y', y);
                previewRectRef.current.setAttribute('width', width);
                previewRectRef.current.setAttribute('height', height);
                previewRectRef.current.style.display = 'block';

                return; // On arrête ici pour le rectangle
            }

            // ------------------------------------------------
            // CAS 2 : POLYLINE / POLYGON / SEGMENT
            // ------------------------------------------------

            // On s'assure que le rectangle est caché
            if (previewRectRef.current) previewRectRef.current.style.display = 'none';

            // 1. Mise à jour de la ligne élastique
            if (previewLineRef.current) {
                previewLineRef.current.setAttribute('x1', lastPoint.x);
                previewLineRef.current.setAttribute('y1', lastPoint.y);
                previewLineRef.current.setAttribute('x2', cursorPos.x);
                previewLineRef.current.setAttribute('y2', cursorPos.y);
                previewLineRef.current.style.display = 'block';
            }

            // 2. Mise à jour du remplissage dynamique (Polygone uniquement)
            if (isPolygon && previewFillRef.current) {
                const staticPart = points.map(p => `${p.x} ${p.y}`).join(' L ');
                const d = `M ${staticPart} L ${cursorPos.x} ${cursorPos.y} Z`;
                previewFillRef.current.setAttribute('d', d);
                previewFillRef.current.style.display = 'block';
            }
        },

        clearPreview: () => {
            if (previewLineRef.current) previewLineRef.current.style.display = 'none';
            if (previewFillRef.current) previewFillRef.current.style.display = 'none';
            if (previewRectRef.current) previewRectRef.current.style.display = 'none'; // Clean
        }
    }));

    // Construction du chemin statique (ce qui est déjà cliqué)
    // Pour le rectangle, "points" ne contient qu'un seul point pendant le dessin, donc staticPath sera vide, ce qui est correct.
    const staticPath = points.length > 1
        ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`
        : '';

    return (
        <g className="drawing-layer">

            {/* A. Dynamic Fill (Polygon) */}
            {isPolygon && (
                <path
                    ref={previewFillRef}
                    fill={fillColor || "rgba(0, 0, 255, 0.1)"}
                    fillRule="evenodd"
                    stroke="none"
                    opacity={0.5}
                    style={{ display: 'none', pointerEvents: 'none' }}
                />
            )}

            {/* B. Dynamic Rectangle (NEW) */}
            {drawRectangle && (
                <rect
                    ref={previewRectRef}
                    fill="none"
                    //fill={fillColor || "rgba(33, 150, 243, 0.2)"} // Bleu semi-transparent par défaut
                    {...(isPolygon && { fill: fillColor || "rgba(92, 92, 236, 0.1)" })}
                    fillOpacity={newAnnotation?.fillOpacity ?? 0.8}
                    stroke={strokeColor || "#2196f3"}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke" // Garde l'épaisseur constante au zoom
                    style={{ display: 'none', pointerEvents: 'none' }}
                />
            )}

            {/* C. Static Stroke (Traits déjà validés) */}
            <path
                d={staticPath}
                stroke={strokeColor || "blue"}
                strokeWidth={2}
                fill="none"
                vectorEffect="non-scaling-stroke"
            />

            {/* D. Vertices (Points déjà validés) */}
            {points.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill={strokeColor || "blue"}
                    vectorEffect="non-scaling-stroke"
                />
            ))}

            {/* E. Zone Closing (Polygon uniquement) */}
            {isPolygon && firstPoint && points.length >= 3 && (
                <circle
                    cx={firstPoint.x}
                    cy={firstPoint.y}
                    r={18}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={20}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onMouseEnter={() => onHoverFirstPoint && onHoverFirstPoint(firstPoint)}
                    onMouseLeave={() => onLeaveFirstPoint && onLeaveFirstPoint()}
                />
            )}

            {/* F. Dynamic Rubber Band (Ligne élastique pour polyline/segment) */}
            {!drawRectangle && (
                <line
                    ref={previewLineRef}
                    stroke={strokeColor || "blue"}
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    vectorEffect="non-scaling-stroke"
                    style={{ display: 'none', pointerEvents: 'none' }}
                />
            )}
        </g>
    );
});

export default DrawingLayer;