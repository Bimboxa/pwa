import { useMemo, useRef, useState } from "react";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import NodeLabelStatic from "./NodeLabelStatic";

// --- CONSTANTES DE STYLE ---
const STYLE_CONSTANTS = {
    COLORS: {
        SELECTED_PART: theme.palette.annotation?.selectedPart || "#ff0000", // Rouge (Segment/Contour sélectionné)
        CUT_SELECTED: "#2196f3", // Bleu (Trou sélectionné)
        CONTEXT: "rgba(0,0,0,0.4)", // Gris foncé (Parties non sélectionnées)
        GHOST: theme.palette.text.disabled || "#ccc", // Pointillés (Segments cachés)
    },
    OPACITIES: {
        FILL_DEFAULT: 0.8,

        // C'est ici qu'on règle la visibilité du reste de l'annotation quand une part est sélectionnée
        FILL_CONTEXT: 0.4,   // Augmenté pour meilleure visibilité (était 0.1)
        STROKE_CONTEXT: 0.3, // Opacité des traits non sélectionnés

        CUT_SELECTED_FILL: 0.3, // Remplissage bleuté du trou sélectionné
        CUT_HOVER_FILL: 0.4,    // Remplissage au survol d'un trou
        CUT_NORMAL_FILL: 0.1,   // Remplissage passif d'un trou (pour le hit)

        GHOST_STROKE: 0.8,      // Opacité des pointillés
    }
};

export default function NodePolylineStatic({
    annotation,
    annotationOverride,
    hovered,
    selected,
    baseMapMeterByPx,
    containerK,
    forceHideLabel,
    isTransient,
    selectedPointId,
    selectedPartId,
    highlightConnectedSegments = false,
}) {

    // select temp annotation

    if (annotation.id.startsWith("temp")) selected = true;

    // State local pour le survol immédiat (feedback visuel)
    const [hoveredPartId, setHoveredPartId] = useState(null);

    // Fusion des props et overrides
    const mergedAnnotation = { ...annotation, ...annotationOverride };

    // --- PROPS EXTRACTION ---
    let {
        id: annotationId,
        type,
        points = [],
        cuts = [],
        strokeColor = theme.palette.secondary.main,
        closeLine = type === "POLYGON",
        fillColor = theme.palette.secondary.main,
        fillOpacity = STYLE_CONSTANTS.OPACITIES.FILL_DEFAULT,
        fillType = "SOLID",
        strokeType = "SOLID",
        strokeOpacity = 1,
        strokeWidth = 2,
        strokeWidthUnit = "PX",
        hiddenSegmentsIdx = [],
    } = mergedAnnotation || {};

    if (type === "POLYGON") closeLine = true;

    const labelAnnotation = getAnnotationLabelPropsFromAnnotation(mergedAnnotation);
    const showLabel = mergedAnnotation.showLabel;
    //const showLabel = false;

    // Fallback couleurs
    if (!strokeColor) strokeColor = theme.palette.secondary.main;
    if (!fillColor) fillColor = theme.palette.secondary.main;
    strokeColor = type === "POLYGON" ? fillColor : strokeColor;

    // --- DATA ATTRIBUTES ---
    const dataProps = {
        "data-node-id": annotationId,
        "data-node-entity-id": mergedAnnotation.entityId,
        "data-node-listing-id": mergedAnnotation.listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": type,
    };

    const patternIdRef = useRef(`hatching-${Math.random().toString(36).substr(2, 9)}`);

    // --- COULEURS CALCULÉES (Mode Standard) ---
    const hoverStrokeColor = useMemo(() => {
        try { return darken(strokeColor, 0.2); } catch { return strokeColor; }
    }, [strokeColor]);

    const hoverFillColor = useMemo(() => {
        try { return darken(fillColor, 0.2); } catch { return fillColor; }
    }, [fillColor]);

    const displayStrokeColor = hovered ? hoverStrokeColor : strokeColor;
    const displayFillColor = hovered ? hoverFillColor : fillColor;

    // --- CALCUL ÉPAISSEUR TRAIT ---
    const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;

    const computedStrokeWidth = useMemo(() => {
        if (type === "POLYGON") return 0.5;
        if (isCmUnit) return (strokeWidth * 0.01) / baseMapMeterByPx;
        return strokeWidth;
    }, [strokeWidth, strokeWidthUnit, baseMapMeterByPx, isCmUnit, type]);


    // --- HELPERS ID & STYLE ---

    const getPartId = (category, index = 0) => `${annotationId}::${category}::${index}`;

    const getPartStyle = (currentPartId) => {
        // A. Mode Standard (Pas de sous-sélection)
        if (!selectedPartId) {
            if (hoveredPartId === currentPartId && !isTransient) {
                return {
                    stroke: darken(strokeColor, 0.2),
                    fill: darken(fillColor, 0.2),
                    strokeWidth: computedStrokeWidth + 1
                };
            }
            return { stroke: strokeColor, fill: fillColor, strokeWidth: computedStrokeWidth };
        }

        // B. Mode Sous-Sélection
        const isSelected = selectedPartId === currentPartId;
        const isHovered = hoveredPartId === currentPartId;

        if (isSelected) {
            return {
                stroke: STYLE_CONSTANTS.COLORS.SELECTED_PART,
                fill: STYLE_CONSTANTS.COLORS.SELECTED_PART,
                strokeWidth: computedStrokeWidth + 0
            };
        } else if (isHovered) {
            return {
                stroke: darken(STYLE_CONSTANTS.COLORS.CONTEXT, 0.4),
                fill: darken(STYLE_CONSTANTS.COLORS.CONTEXT, 0.4),
                strokeWidth: computedStrokeWidth + 0
            };
        } else {
            // Contexte (Parties non sélectionnées)
            return {
                stroke: STYLE_CONSTANTS.COLORS.CONTEXT,
                fill: STYLE_CONSTANTS.COLORS.CONTEXT,
                strokeWidth: computedStrokeWidth,
                strokeOpacity: STYLE_CONSTANTS.OPACITIES.STROKE_CONTEXT,
                fillOpacity: STYLE_CONSTANTS.OPACITIES.FILL_CONTEXT // <--- C'est ici que l'opacité est gérée
            };
        }
    };

    // --- GÉOMÉTRIE (Path Building) ---

    const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

    function circleFromThreePoints(p0, p1, p2) {
        const x1 = p0.x, y1 = p0.y;
        const x2 = p1.x, y2 = p1.y;
        const x3 = p2.x, y3 = p2.y;
        const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
        if (Math.abs(d) < 1e-9) return null;
        const ux = (x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2);
        const uy = (x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1);
        const cx = ux / d;
        const cy = uy / d;
        return { center: { x: cx, y: cy }, r: Math.hypot(x1 - cx, y1 - cy) };
    }

    function buildPathAndMap(absPoints, close) {
        const res = { d: "", segmentMap: [] };
        if (!absPoints?.length) return res;

        const pts = absPoints;
        const types = absPoints.map(typeOf);
        const n = pts.length;
        const dParts = [`M ${pts[0].x} ${pts[0].y}`];

        if (n === 1) {
            res.d = dParts.join(" ");
            return res;
        }

        const idx = (i) => (close ? (i + n) % n : i);
        const limit = close ? n : n - 1;

        let i = 0;
        try {
            while (i < limit) {
                const i0 = idx(i);
                const i1 = idx(i + 1);
                const t0 = types[i0];
                const t1 = types[i1];
                const pStart = pts[i0];

                if (t0 === "square" && t1 === "circle") {
                    let j = i + 1;
                    while (j < i + n && types[idx(j)] === "circle") j += 1;
                    const i2 = idx(j);

                    if (!close && j >= n) {
                        const P1 = pts[i1];
                        const cmd = `L ${P1.x} ${P1.y}`;
                        dParts.push(cmd);
                        res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1, d: `M ${pStart.x} ${pStart.y} ${cmd}` });
                        i += 1;
                        continue;
                    }

                    const isExactSCS = j === i + 2 && types[i1] === "circle" && types[idx(i + 2)] === "square";

                    if (isExactSCS) {
                        const P0 = pts[i0];
                        const P1 = pts[i1];
                        const P2 = pts[i2];
                        const circ = circleFromThreePoints(P0, P1, P2);

                        if (!circ || !Number.isFinite(circ.r) || circ.r <= 0) {
                            const cmd1 = `L ${P1.x} ${P1.y}`;
                            const cmd2 = `L ${P2.x} ${P2.y}`;
                            dParts.push(cmd1, cmd2);
                            res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1, d: `M ${P0.x} ${P0.y} ${cmd1}` });
                            res.segmentMap.push({ startPointIdx: i1, endPointIdx: i2, d: `M ${P1.x} ${P1.y} ${cmd2}` });
                        } else {
                            const { center: C, r } = circ;
                            const cross = (P1.x - P0.x) * (P2.y - P0.y) - (P1.y - P0.y) * (P2.x - P0.x);
                            const sweep = cross > 0 ? 1 : 0;
                            const rSafe = r * 1.0005;
                            const cmd1 = `A ${rSafe} ${rSafe} 0 0 ${sweep} ${P1.x} ${P1.y}`;
                            const cmd2 = `A ${rSafe} ${rSafe} 0 0 ${sweep} ${P2.x} ${P2.y}`;
                            dParts.push(cmd1, cmd2);
                            res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1, isArc: true, d: `M ${P0.x} ${P0.y} ${cmd1}` });
                            res.segmentMap.push({ startPointIdx: i1, endPointIdx: i2, isArc: true, d: `M ${P1.x} ${P1.y} ${cmd2}` });
                        }
                        i += 2;
                        continue;
                    }

                    let k = i;
                    dParts.push(`L ${pts[i0].x} ${pts[i0].y}`);
                    while (k < i2) {
                        const p0 = pts[idx(k)];
                        const p1 = pts[idx(k + 1)];
                        const cp1 = { x: p0.x + (p1.x - p0.x) / 3, y: p0.y + (p1.y - p0.y) / 3 };
                        const cp2 = { x: p1.x - (p1.x - p0.x) / 3, y: p1.y - (p1.y - p0.y) / 3 };
                        const cmd = `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p1.x} ${p1.y}`;
                        dParts.push(cmd);
                        res.segmentMap.push({ startPointIdx: idx(k), endPointIdx: idx(k + 1), d: `M ${p0.x} ${p0.y} ${cmd}` });
                        k++;
                    }
                    i = i2;
                    continue;
                }

                const P1 = pts[i1];
                const cmd = `L ${P1.x} ${P1.y}`;
                dParts.push(cmd);
                res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1, d: `M ${pts[i0].x} ${pts[i0].y} ${cmd}` });
                i++;
            }
        } catch (e) {
            console.error("Geometry Error", e);
        }

        if (close) dParts.push("Z");
        res.d = dParts.join(" ");
        return res;
    }

    const { d: pathD, segmentMap } = useMemo(
        () => buildPathAndMap(points, closeLine),
        [points, closeLine]
    );

    const holesData = useMemo(() => {
        if (!cuts || cuts.length === 0) return [];
        return cuts.map((cut, index) => ({
            ...buildPathAndMap(cut.points, true),
            id: cut.id,
            partId: getPartId("CUT", index)
        }));
    }, [cuts, annotationId]);

    const fullFillD = useMemo(() => {
        let d = pathD;
        if (holesData.length > 0) d += " " + holesData.map(h => h.d).join(" ");
        return d;
    }, [pathD, holesData]);


    // --- RENDU SEGMENTS (Strokes) ---

    const renderSegments = (segmentsList, basePartType, contextIndex = 0) => {
        return segmentsList.map((seg, idx) => {

            // 1. Identification
            let partId;
            if (type === "POLYLINE") {
                partId = getPartId("SEG", idx);
            } else {
                partId = getPartId(basePartType, contextIndex);
            }

            const style = getPartStyle(partId);
            const finalStrokeOpacity = style.strokeOpacity ?? strokeOpacity;
            const isSelected = selectedPartId === partId;

            // 2. Gestion Couleur Spéciale (Bleu pour Cut sélectionné)
            let displayColor = style.stroke;
            if (basePartType === 'CUT' && isSelected) {
                displayColor = STYLE_CONSTANTS.COLORS.CUT_SELECTED;
            }

            // 3. Gestion Segments Cachés (Ghost)
            const isMainPath = segmentsList === segmentMap;
            const isHidden = isMainPath && hiddenSegmentsIdx?.includes(idx);

            if (isHidden) {
                if (!selected) return null; // Invisible si non sélectionné

                // Mode Ghost
                const isGhostSelected = selectedPartId === partId;
                const isGhostHovered = hoveredPartId === partId;
                const ghostColor = (isGhostSelected || isGhostHovered)
                    ? style.stroke
                    : STYLE_CONSTANTS.COLORS.GHOST;

                return (
                    <g
                        key={`seg-hidden-${idx}`}
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredPartId(partId); }}
                        onMouseLeave={() => setHoveredPartId(null)}
                        data-part-id={partId}
                        data-node-id={annotationId}
                        style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                    >
                        {/* Hit Area Large */}
                        <path d={seg.d} fill="none" stroke="transparent" strokeWidth={Math.max(14, computedStrokeWidth * 3)} />
                        {/* Visuel Ghost */}
                        <path
                            d={seg.d}
                            fill="none"
                            stroke={ghostColor}
                            strokeWidth={computedStrokeWidth}
                            strokeDasharray="4 12"
                            strokeOpacity={STYLE_CONSTANTS.OPACITIES.GHOST_STROKE}
                            strokeLinecap="round"
                            style={{ pointerEvents: "none" }}
                        />
                    </g>
                );
            }

            let displayedStrokeWidth = computedStrokeWidth;

            if (selected) {
                if (isCmUnit) {
                    // En mode métrique, on épaissit par un facteur multiplicatif pour garder l'échelle
                    displayedStrokeWidth = computedStrokeWidth * 1;
                } else {
                    // En mode pixel écran, on ajoute des pixels fixes
                    displayedStrokeWidth = computedStrokeWidth + 0;
                }
            }


            // 4. Rendu Normal
            return (
                <g
                    key={`seg-${idx}-${seg.startPointIdx}`}
                    onMouseEnter={(e) => { e.stopPropagation(); setHoveredPartId(partId); }}
                    onMouseLeave={() => setHoveredPartId(null)}
                    data-part-id={partId}
                    data-node-id={annotationId}
                    style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                >
                    <path
                        d={seg.d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(14, isCmUnit ? computedStrokeWidth * 3 : 14)}
                    //vectorEffect={isCmUnit ? undefined : "non-scaling-stroke"}
                    />
                    <path
                        d={seg.d}
                        fill="none"
                        stroke={displayColor}
                        strokeWidth={displayedStrokeWidth}
                        strokeOpacity={finalStrokeOpacity}
                        // strokeDasharray={
                        //     strokeType === "DASHED"
                        //         ? `${computedStrokeWidth * 1} ${computedStrokeWidth * 1.5}`
                        //         : undefined
                        // }

                        strokeLinecap="round" // round, bevel, ...
                        // strokeLinejoin={strokeType === "DASHED" ? "bevel" : "round"}
                        strokeLinejoin="round"
                        //vectorEffect={isCmUnit ? undefined : "non-scaling-stroke"}
                        style={{ pointerEvents: "none", transition: "stroke 0.2s" }}

                        {...(strokeType === "DASHED" && {
                            strokeDasharray: "1 1",
                            strokeLinejoin: "bevel",
                            strokeLinecap: "bevel"
                        })}
                    />
                </g>
            );
        });
    };

    // --- RENDU CONNECTED SEGMENTS (Highlight temporaire) ---
    const renderConnectedSegments = () => {
        if (!selectedPointId || !highlightConnectedSegments) return null;

        const allPaths = [
            { points: mergedAnnotation.points, map: segmentMap },
            ...holesData.map(h => ({ points: h.points || cuts.find(c => c.id === h.id)?.points, map: h.segmentMap }))
        ];

        const segmentsToDraw = [];
        allPaths.forEach(({ points, map }) => {
            if (!points || !map) return;
            map.forEach(seg => {
                const pStart = points[seg.startPointIdx];
                const pEnd = points[seg.endPointIdx];
                const isConnected = (pStart?.id === selectedPointId) || (pEnd?.id === selectedPointId);
                if (isConnected) {
                    segmentsToDraw.push(
                        <path
                            key={`highlight-${seg.d}`}
                            d={seg.d}
                            fill="none"
                            stroke={theme.palette.annotation.selected}
                            strokeWidth={(computedStrokeWidth || 2) + 2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            style={{ pointerEvents: "none" }}
                        />
                    );
                }
            });
        });
        return segmentsToDraw;
    };

    // --- RENDU POINTS (VERTEX) ---

    const POINT_SIZE = 6;
    const HALF_SIZE = POINT_SIZE / 2;
    const vertexScaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    const renderVertex = (pt) => {
        const isPointSelected = selectedPointId === pt.id;
        return (
            <g
                key={pt.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                style={{ cursor: isTransient ? 'crosshair' : 'pointer', pointerEvents: 'all' }}
                data-node-type="VERTEX"
                data-point-id={pt.id}
                data-annotation-id={annotationId}
            >
                <g style={{ transform: vertexScaleTransform }}>
                    <rect
                        x={-HALF_SIZE} y={-HALF_SIZE} width={POINT_SIZE} height={POINT_SIZE}
                        fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
                        stroke="#2196f3"
                        strokeWidth={1.5}
                    />
                </g>
            </g>
        );
    };

    // --- FILTRAGE DES POINTS À AFFICHER ---
    // Logique : Afficher uniquement les points du contour sélectionné (Main ou Cut)
    const allPoints = [
        ...(mergedAnnotation.points || []),
        ...(mergedAnnotation.cuts || []).flatMap(c => c.points || [])
    ];

    let pointsToRender = [];
    if (selectedPartId) {
        const parts = selectedPartId.split('::');
        const partType = parts[1];
        const partIndex = parseInt(parts[2], 10);

        if (partType === 'CUT') {
            pointsToRender = mergedAnnotation.cuts?.[partIndex]?.points || [];
        } else if (partType === 'MAIN' || partType === 'SEG') {
            pointsToRender = mergedAnnotation.points || [];
        }
    } else {
        pointsToRender = allPoints;
    }

    // Sécurité : inclure le point sélectionné
    if (selectedPointId) {
        const specificPoint = allPoints.find(p => p.id === selectedPointId);
        if (specificPoint && !pointsToRender.find(p => p.id === selectedPointId)) {
            pointsToRender = [...pointsToRender, specificPoint];
        }
    }


    // --- RENDER FINAL ---

    if (!points?.length) return null;

    const showFill = type === "POLYGON";
    const HATCHING_SPACING = 12;

    // --- NOUVEAU : Logique Eraser ---
    const isEraser = mergedAnnotation.isEraser;
    const ERASER_PATTERN_ID = `eraser-${annotationId}`;
    const ERASER_SPACING = 10; // Espacement des tirets

    const mainPartId = getPartId("MAIN", 0);
    const mainFillStyle = getPartStyle(mainPartId);

    // Détermination de la valeur finale de fill (Couleur ou Pattern)
    let finalFill = mainFillStyle?.fill;

    if (isEraser) {
        finalFill = `url(#${ERASER_PATTERN_ID})`;
    } else if (fillType === "HATCHING" || fillType === "HATCHING_LEFT") {
        finalFill = `url(#${patternIdRef.current})`;
    }

    return (
        <g {...dataProps}>
            {/* HATCHING PATTERN */}
            <defs>
                {/* 1. PATTERN ERASER (Petits tirets horizontaux) */}
                {isEraser && (
                    <pattern
                        id={ERASER_PATTERN_ID}
                        patternUnits="userSpaceOnUse"
                        width={ERASER_SPACING}
                        height={ERASER_SPACING}
                    >
                        {/* Petit trait horizontal centré */}
                        <line
                            x1={2} y1={ERASER_SPACING / 2}
                            x2={ERASER_SPACING - 2} y2={ERASER_SPACING / 2}
                            stroke={fillColor}
                            strokeWidth={1.5}
                            strokeOpacity={0.7}
                        />
                    </pattern>
                )}

                {/* 2. PATTERN HACHURES (Existant) */}
                {!isEraser && showFill && (fillType === "HATCHING" || fillType === "HATCHING_LEFT") && (
                    <pattern id={patternIdRef.current} patternUnits="userSpaceOnUse" width={HATCHING_SPACING} height={HATCHING_SPACING}>
                        {fillType === "HATCHING" ? (
                            <path d={`M 0,${HATCHING_SPACING} L ${HATCHING_SPACING},0`} stroke={fillColor} strokeWidth={2} />
                        ) : (
                            <path d={`M 0,0 L ${HATCHING_SPACING},${HATCHING_SPACING}`} stroke={fillColor} strokeWidth={2} />
                        )}
                    </pattern>
                )}
            </defs>

            {/* MAIN FILL */}
            {showFill && (
                <path
                    d={fullFillD}
                    fill={finalFill} // Utilise le pattern calculé
                    fillOpacity={isEraser ? 1 : (mainFillStyle.fillOpacity ?? fillOpacity)} // Opacité pleine pour le motif eraser
                    fillRule="evenodd"
                    stroke="none"
                    style={{ cursor: isTransient ? "crosshair" : "pointer", transition: "fill 0.2s" }}
                    onMouseEnter={() => setHoveredPartId(mainPartId)}
                    onMouseLeave={() => setHoveredPartId(null)}
                    data-part-type="MAIN"
                    {...dataProps}
                />
            )}

            {/* CUTS FILL (Hit Area + Selection Feedback) */}
            {selected && !isTransient && holesData.map((hole, i) => {
                const partId = getPartId("CUT", i);
                const style = getPartStyle(partId);
                const isSelected = selectedPartId === partId;
                const isHovered = hoveredPartId === partId;

                // Bleu si sélectionné, sinon couleur dynamique (ou contexte)
                const holeFill = isSelected ? STYLE_CONSTANTS.COLORS.CUT_SELECTED : (isHovered ? style.fill : displayFillColor);

                // Gestion fine des opacités pour les trous
                let holeOpacity = STYLE_CONSTANTS.OPACITIES.CUT_NORMAL_FILL; // Par défaut faible
                if (isSelected) holeOpacity = STYLE_CONSTANTS.OPACITIES.CUT_SELECTED_FILL;
                else if (isHovered) holeOpacity = STYLE_CONSTANTS.OPACITIES.CUT_HOVER_FILL;

                return (
                    <path
                        key={`hole-fill-${i}`}
                        d={hole.d}
                        fill={holeFill}
                        fillOpacity={holeOpacity}
                        stroke="none"
                        style={{ cursor: "pointer" }}
                        data-part-id={partId}
                        data-part-type="CUT"
                        data-node-id={annotationId}
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredPartId(partId); }}
                        onMouseLeave={() => setHoveredPartId(null)}
                    />
                );
            })}

            {/* STROKES (Main) */}
            {strokeType !== "NONE" && renderSegments(segmentMap, 'MAIN', 0)}

            {/* STROKES (Cuts) */}
            {strokeType !== "NONE" && holesData.map((hole, i) => (
                <g key={`hole-strokes-${i}`}>
                    {renderSegments(hole.segmentMap, 'CUT', i)}
                </g>
            ))}

            {/* CONNECTED SEGMENTS HIGHLIGHT */}
            {renderConnectedSegments()}

            {/* POINTS */}
            {selected && pointsToRender.map(pt => renderVertex(pt))}

            {/* LABEL */}
            {showLabel && <NodeLabelStatic annotation={labelAnnotation} containerK={containerK} hidden={!mergedAnnotation.showLabel} />}
        </g>
    );
}