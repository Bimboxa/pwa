// components/DrawingLayer.jsx
import React, { forwardRef, useImperativeHandle, useRef, useMemo, useEffect } from 'react';

import { getCircleFrom3Points } from "Features/geometry/utils/getPolylinePointsFromCircle";

// Compute offset polyline with proper miter joints at corners
function offsetPolyline(pts, distance) {
    const len = pts.length;
    if (len < 2) return [];

    // Compute per-segment offset lines (point + direction vector)
    const lines = [];
    for (let i = 0; i < len - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (segLen === 0) continue;
        const ux = dx / segLen, uy = dy / segLen;
        const nx = -uy, ny = ux; // normal (90° rotation)
        lines.push({
            p: { x: pts[i].x + nx * distance, y: pts[i].y + ny * distance },
            v: { x: ux, y: uy },
            segLen,
        });
    }
    if (lines.length === 0) return [];

    const result = [lines[0].p]; // first point

    // Interior points: miter joint via line-line intersection
    for (let i = 1; i < lines.length; i++) {
        const prev = lines[i - 1], curr = lines[i];
        const cross = prev.v.x * curr.v.y - prev.v.y * curr.v.x;
        if (Math.abs(cross) < 1e-5) {
            result.push(curr.p); // parallel segments
        } else {
            const dp = { x: curr.p.x - prev.p.x, y: curr.p.y - prev.p.y };
            const t = (dp.x * curr.v.y - dp.y * curr.v.x) / cross;
            result.push({ x: prev.p.x + t * prev.v.x, y: prev.p.y + t * prev.v.y });
        }
    }

    // Last point: project along last segment direction
    const last = lines[lines.length - 1];
    result.push({ x: last.p.x + last.v.x * last.segLen, y: last.p.y + last.v.y * last.segLen });

    return result;
}

// Compute strip band path: original polyline + offset polyline reversed
function computeStripPath(pts, distance) {
    if (pts.length < 2) return "";
    const offset = offsetPolyline(pts, distance);
    if (offset.length < 2) return "";
    const all = [...pts, ...offset.reverse()];
    return "M " + all.map(p => `${p.x} ${p.y}`).join(" L ") + " Z";
}

const STRIP_DEFAULT_WIDTH = 20; // px, same as getStripePolygons default

const DrawingLayer = forwardRef(({
    points,
    newAnnotation,
    enabledDrawingMode,
    containerK,
    meterByPx,
    orthoSnapAngleOffset = 0,
}, ref) => {


    // Refs pour l'accès DOM direct (Performance)
    const previewLineRef = useRef(null);
    const previewFillRef = useRef(null);
    const previewRectRef = useRef(null); // <--- NOUVELLE REF
    const previewCircleRef = useRef(null);
    const previewStripRef = useRef(null);

    // Keep refs so the imperative handle always reads fresh values
    const newAnnotationRef = useRef(newAnnotation);
    useEffect(() => {
        newAnnotationRef.current = newAnnotation;
    }, [newAnnotation]);

    // Sync ref immediately during render (not in useEffect which runs after paint)
    const pointsRef = useRef(points);
    pointsRef.current = points;

    const meterByPxRef = useRef(meterByPx);
    meterByPxRef.current = meterByPx;

    const orthoSnapAngleOffsetRef = useRef(orthoSnapAngleOffset);
    orthoSnapAngleOffsetRef.current = orthoSnapAngleOffset;

    const { strokeColor, fillColor, type } = newAnnotation || {};

    // Détection des types
    const isPolygon = type === "POLYGON";
    const isStrip = type === "STRIP";
    const drawRectangle = ["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode);
    const drawCircle = ["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode);

    const firstPoint = points?.[0];

    useImperativeHandle(ref, () => ({
        // Force-update the points ref immediately (bypasses React render cycle)
        setPoints: (newPoints) => {
            pointsRef.current = newPoints;
        },
        updatePreview: (cursorPos) => {
            // Use ref to always get the latest points
            const currentPoints = pointsRef.current;
            // S'il n'y a pas encore de point posé, on ne dessine rien
            if (!currentPoints || currentPoints.length === 0) return;

            const lastPoint = currentPoints[currentPoints.length - 1];

            // ------------------------------------------------
            // CAS 1 : RECTANGLE (1er point fixe -> Curseur)
            // ------------------------------------------------
            if (drawRectangle && previewRectRef.current) {
                // On cache les éléments inutiles pour ce mode
                if (previewLineRef.current) previewLineRef.current.style.display = 'none';
                if (previewFillRef.current) previewFillRef.current.style.display = 'none';

                const angle = orthoSnapAngleOffsetRef.current || 0;

                if (angle === 0) {
                    // Axis-aligned rectangle (original behavior)
                    const x = Math.min(lastPoint.x, cursorPos.x);
                    const y = Math.min(lastPoint.y, cursorPos.y);
                    const width = Math.abs(cursorPos.x - lastPoint.x);
                    const height = Math.abs(cursorPos.y - lastPoint.y);
                    previewRectRef.current.setAttribute('points',
                        `${x},${y} ${x + width},${y} ${x + width},${y + height} ${x},${y + height}`);
                } else {
                    // Rotated rectangle: project diagonal onto ortho snap grid axes
                    // Snap grid primary axis is at -offset in screen coords (Y down)
                    const theta = (-angle * Math.PI) / 180;
                    const ax1 = { x: Math.cos(theta), y: Math.sin(theta) };
                    const ax2 = { x: -Math.sin(theta), y: Math.cos(theta) };

                    const dx = cursorPos.x - lastPoint.x;
                    const dy = cursorPos.y - lastPoint.y;

                    // Project diagonal onto the two grid axes
                    const d1 = dx * ax1.x + dy * ax1.y;
                    const d2 = dx * ax2.x + dy * ax2.y;

                    // 4 corners: A, B, C (=cursor projected), D
                    const A = lastPoint;
                    const B = { x: A.x + d1 * ax1.x, y: A.y + d1 * ax1.y };
                    const C = { x: B.x + d2 * ax2.x, y: B.y + d2 * ax2.y };
                    const D = { x: A.x + d2 * ax2.x, y: A.y + d2 * ax2.y };

                    previewRectRef.current.setAttribute('points',
                        `${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`);
                }

                previewRectRef.current.style.display = 'block';
                return; // On arrête ici pour le rectangle
            }

            // ------------------------------------------------
            // CAS 1b : CIRCLE (2 points placed -> preview with cursor as 3rd)
            // ------------------------------------------------
            if (drawCircle && currentPoints.length >= 2 && previewCircleRef.current) {
                if (previewLineRef.current) previewLineRef.current.style.display = 'none';
                if (previewFillRef.current) previewFillRef.current.style.display = 'none';
                if (previewRectRef.current) previewRectRef.current.style.display = 'none';

                const circle = getCircleFrom3Points(currentPoints[0], currentPoints[1], cursorPos);
                if (circle) {
                    previewCircleRef.current.setAttribute('cx', circle.cx);
                    previewCircleRef.current.setAttribute('cy', circle.cy);
                    previewCircleRef.current.setAttribute('r', circle.r);
                    previewCircleRef.current.style.display = 'block';
                } else {
                    previewCircleRef.current.style.display = 'none';
                }
                return;
            }

            // Hide circle preview when not in CIRCLE mode with 2+ points
            if (previewCircleRef.current) previewCircleRef.current.style.display = 'none';

            // ------------------------------------------------
            // CAS 2b : STRIP (Band preview)
            // ------------------------------------------------
            if (isStrip && previewStripRef.current) {
                if (previewRectRef.current) previewRectRef.current.style.display = 'none';

                const allPts = [...currentPoints, cursorPos];
                const na = newAnnotationRef.current;
                const rawWidth = na?.strokeWidth ?? STRIP_DEFAULT_WIDTH;
                const stripOrientation = na?.stripOrientation ?? 1;
                const isCm = na?.strokeWidthUnit === "CM" && meterByPxRef.current > 0;
                const stripWidth = isCm ? (rawWidth * 0.01) / meterByPxRef.current : rawWidth;
                const d = computeStripPath(allPts, stripWidth * stripOrientation);
                previewStripRef.current.setAttribute('d', d);
                previewStripRef.current.style.display = 'block';

                // Also show elastic line
                if (previewLineRef.current) {
                    previewLineRef.current.setAttribute('x1', lastPoint.x);
                    previewLineRef.current.setAttribute('y1', lastPoint.y);
                    previewLineRef.current.setAttribute('x2', cursorPos.x);
                    previewLineRef.current.setAttribute('y2', cursorPos.y);
                    previewLineRef.current.style.display = 'block';
                }
                return;
            }

            // ------------------------------------------------
            // CAS 2 : POLYLINE / POLYGON / SEGMENT
            // ------------------------------------------------

            // On s'assure que le rectangle est caché
            if (previewRectRef.current) previewRectRef.current.style.display = 'none';
            if (previewStripRef.current) previewStripRef.current.style.display = 'none';

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
                const staticPart = currentPoints.map(p => `${p.x} ${p.y}`).join(' L ');
                const d = `M ${staticPart} L ${cursorPos.x} ${cursorPos.y} Z`;
                previewFillRef.current.setAttribute('d', d);
                previewFillRef.current.style.display = 'block';
            }
        },

        clearPreview: () => {
            if (previewLineRef.current) previewLineRef.current.style.display = 'none';
            if (previewFillRef.current) previewFillRef.current.style.display = 'none';
            if (previewRectRef.current) previewRectRef.current.style.display = 'none';
            if (previewCircleRef.current) previewCircleRef.current.style.display = 'none';
            if (previewStripRef.current) previewStripRef.current.style.display = 'none';
        }
    }));

    // Construction du chemin statique (ce qui est déjà cliqué)
    // Pour le rectangle, "points" ne contient qu'un seul point pendant le dessin, donc staticPath sera vide, ce qui est correct.
    const staticPath = points.length > 1
        ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`
        : '';

    // Scale pour les points fixes
    const scaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    return (
        <g className="drawing-layer">

            {/* A0. Strip band — dynamic preview (all points + cursor) */}
            {isStrip && (
                <path
                    ref={previewStripRef}
                    fill={strokeColor || fillColor || "rgba(92, 92, 236, 0.3)"}
                    opacity={0.25}
                    stroke="none"
                    style={{ display: 'none', pointerEvents: 'none' }}
                />
            )}

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

            {/* B. Dynamic Rectangle (polygon for rotation support) */}
            {drawRectangle && (
                <polygon
                    ref={previewRectRef}
                    fill="none"
                    {...(isPolygon && { fill: fillColor || "rgba(92, 92, 236, 0.1)" })}
                    fillOpacity={newAnnotation?.fillOpacity ?? 0.8}
                    stroke={strokeColor || "#2196f3"}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    style={{ display: 'none', pointerEvents: 'none' }}
                />
            )}

            {/* B2. Dynamic Circle preview */}
            {drawCircle && (
                <circle
                    ref={previewCircleRef}
                    fill="none"
                    {...(isPolygon && { fill: fillColor || "rgba(92, 92, 236, 0.1)" })}
                    fillOpacity={newAnnotation?.fillOpacity ?? 0.8}
                    stroke={strokeColor || "#2196f3"}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
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
                    r={3} // Taille fixe visuelle (avant transform)
                    cx={0} cy={0} // Centré car on translate via le groupe ou le transform direct
                    fill={strokeColor || "blue"}
                    style={{
                        transform: `translate(${p.x}px, ${p.y}px) ${scaleTransform}`,
                        vectorEffect: "non-scaling-stroke" // Peut-être redundante si on scale le container, mais safe
                    }}
                />
            ))}

            {/* E. Zone Closing — now handled in InteractionLayer via screen-distance check */}

            {/* F. Dynamic Rubber Band (Ligne élastique pour polyline/segment) */}
            {!drawRectangle && !(drawCircle && points.length >= 2) && (
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