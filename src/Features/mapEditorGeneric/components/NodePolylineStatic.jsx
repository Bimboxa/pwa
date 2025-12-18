import { useMemo, useRef, useState } from "react";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";

import NodeLabelStatic from "./NodeLabelStatic";

const COLOR_SELECTED_PART = theme.palette.annotation?.selectedPart || "#ff0000";
const COLOR_CONTEXT = theme.palette.annotation?.selectedPartContext || "rgba(0,0,0,0.2)";

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

    // hover -state
    const [hoveredPartId, setHoveredPartId] = useState(null);


    // overrided annotation

    annotation = { ...annotation, ...annotationOverride };


    // TEMP - TO DO - BETTER MANAGE LABEL

    // const showLabel = (annotation.showLabel || selected) && !forceHideLabel;
    const showLabel = false

    // ===== label Annotation =====
    const labelAnnotation = getAnnotationLabelPropsFromAnnotation(annotation);

    let {
        id: annotationId,
        type,
        points = [],
        cuts = [], //  Extract cuts (holes)
        strokeColor = theme.palette.secondary.main,
        closeLine = type === "POLYGON",
        fillColor = theme.palette.secondary.main,
        fillOpacity = 0.8,
        fillType = "SOLID",
        strokeType = "SOLID",
        strokeOpacity = 1,
        strokeWidth = 2,
        strokeWidthUnit = "PX",
        hiddenSegmentsIdx = [],
    } = annotation || {};


    const dataProps = {
        "data-node-id": annotation.id,
        "data-node-listing-id": annotation.listingId, // key for context menu
        "data-node-type": "ANNOTATION",
        "data-annotation-type": type,
    };


    const patternIdRef = useRef(`hatching-${Math.random().toString(36).substr(2, 9)}`);


    strokeColor = type === "POLYGON" ? fillColor : strokeColor;

    const hoverStrokeColor = useMemo(() => {
        try {
            return darken(strokeColor, 0.2);
        } catch {
            return strokeColor;
        }
    }, [strokeColor]);

    const hoverFillColor = useMemo(() => {
        try {
            return darken(fillColor, 0.2);
        } catch {
            return fillColor;
        }
    }, [fillColor]);

    const displayStrokeColor = hovered ? hoverStrokeColor : strokeColor;
    const displayFillColor = hovered ? hoverFillColor : fillColor;

    // 1. Calculate the Stroke Width
    const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;

    const computedStrokeWidth = useMemo(() => {
        if (type === "POLYGON") {
            return 0.5;
        }
        if (isCmUnit) {
            return (strokeWidth * 0.01) / baseMapMeterByPx;
        }
        return strokeWidth;
    }, [strokeWidth, strokeWidthUnit, baseMapMeterByPx, isCmUnit, type]);


    // --- ID GENERATION ---
    const getPartId = (category, index = 0) => `${annotationId}::${category}::${index}`;

    // --- STYLE DYNAMIQUE ---
    const getPartStyle = (currentPartId) => {
        if (!selectedPartId) {
            // Hover simple (hors mode sélection de part)
            if (hoveredPartId === currentPartId && !isTransient) {
                return {
                    stroke: darken(strokeColor, 0.2),
                    fill: darken(fillColor, 0.2),
                    strokeWidth: computedStrokeWidth + 1
                };
            }
            return { stroke: strokeColor, fill: fillColor, strokeWidth: computedStrokeWidth };
        }

        const isSelected = selectedPartId === currentPartId;
        const isHovered = hoveredPartId === currentPartId;

        if (isSelected) {
            return {
                stroke: COLOR_SELECTED_PART,
                fill: COLOR_SELECTED_PART,
                strokeWidth: computedStrokeWidth + 2
            };
        } else if (isHovered) {
            return {
                stroke: darken(COLOR_CONTEXT, 0.4),
                fill: darken(COLOR_CONTEXT, 0.4),
                strokeWidth: computedStrokeWidth + 1
            };
        } else {
            return {
                stroke: COLOR_CONTEXT,
                fill: COLOR_CONTEXT,
                strokeWidth: computedStrokeWidth,
                strokeOpacity: 0.3,
                fillOpacity: 0.1
            };
        }
    };


    // Helper functions
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

    // Build path
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
            console.log("error NodePolylineStatic", e);
        }

        if (close) dParts.push("Z");
        res.d = dParts.join(" ");
        return res;
    }

    // [NEW] 1. Memoize Main Path
    const { d: pathD, segmentMap } = useMemo(
        () => buildPathAndMap(points, closeLine),
        [points, closeLine]
    );

    // [NEW] 2. Memoize Holes Path (Cuts)
    const holesData = useMemo(() => {
        if (!cuts || cuts.length === 0) return [];
        return cuts.map(cut => ({
            ...buildPathAndMap(cut.points, true), // Holes are usually closed
            id: cut.id
        }));
    }, [cuts]);

    // [NEW] 3. Combine Paths for Fill (Main + Holes)
    const fullFillD = useMemo(() => {
        let d = pathD;
        if (holesData.length > 0) {
            d += " " + holesData.map(h => h.d).join(" ");
        }
        return d;
    }, [pathD, holesData]);


    const showFill = type === "POLYGON";
    const HATCHING_SPACING = 12;

    if (!points?.length) return null;

    // Helper to render a segment stroke (used for main path and holes)
    const renderSegments = (segmentsList, basePartType, contextIndex = 0) => {
        return segmentsList.map((seg, idx) => {
            // Note: Holes might not have corresponding 'segments' metadata in annotation.segments
            // We assume hole segments are always visible unless we map them to annotation structure.
            // If segmentsList comes from main loop, we check deletion.

            // Génération de l'ID (ex: "123::SEG::0")
            let partId;
            if (type === "POLYLINE") {
                partId = getPartId("SEG", idx);
            } else {
                partId = getPartId(basePartType, contextIndex);
            }

            const style = getPartStyle(partId);
            const finalStrokeOpacity = style.strokeOpacity ?? strokeOpacity;

            // 2. ÉTAT MASQUÉ
            const isMainPath = segmentsList === segmentMap;
            const isHidden = isMainPath && hiddenSegmentsIdx?.includes(idx);

            // --- CAS A : SEGMENT MASQUÉ (GHOST) ---
            if (isHidden) {
                // Si l'annotation n'est pas sélectionnée, on ne dessine rien (trou invisible)
                if (!selected) return null;

                // Si sélectionnée, on dessine le fantôme INTERACTIF
                const isGhostSelected = selectedPartId === partId;
                const isGhostHovered = hoveredPartId === partId;

                // Couleur du fantôme :
                // - Si sélectionné/survolé : Couleur active (rouge/sombre)
                // - Sinon : Gris standard
                const ghostColor = (isGhostSelected || isGhostHovered)
                    ? style.stroke
                    : (theme.palette.text.disabled || "#ccc");

                return (
                    <g
                        key={`seg-hidden-${idx}`}
                        // INTERACTION
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredPartId(partId); }}
                        onMouseLeave={() => setHoveredPartId(null)}
                        data-part-id={partId}
                        data-node-id={annotationId}
                        style={{ cursor: isTransient ? "crosshair" : "pointer" }} // Indique qu'on peut cliquer
                    >
                        {/* 1. HIT AREA (Large & Transparent) */}
                        <path
                            d={seg.d}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={Math.max(14, computedStrokeWidth * 3)}
                        />

                        {/* 2. VISUEL (Pointillés) */}
                        <path
                            d={seg.d}
                            fill="none"
                            stroke={ghostColor}
                            strokeWidth={computedStrokeWidth}
                            strokeDasharray="4 12" // Dashed
                            strokeOpacity={0.8}
                            strokeLinecap="round"
                            style={{ pointerEvents: "none" }} // Laisse passer le clic vers le Hit Area
                        />
                    </g>
                );
            }

            return (
                <g
                    key={`seg-${idx}-${seg.startPointIdx}`}
                    data-part-id={partId}
                    data-node-id={annotationId} // Rappel de l'ID parent pour sécurité
                    onMouseEnter={(e) => { e.stopPropagation(); setHoveredPartId(partId); }}
                    onMouseLeave={() => setHoveredPartId(null)}
                >
                    {/* Hit Area */}
                    <path
                        d={seg.d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(14, isCmUnit ? computedStrokeWidth * 3 : 14)}
                        style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                        vectorEffect={isCmUnit ? undefined : "non-scaling-stroke"}
                        {...dataProps}

                    />
                    {/* Visible Stroke */}
                    <path
                        d={seg.d}
                        fill="none"
                        stroke={displayStrokeColor}
                        strokeWidth={computedStrokeWidth}
                        strokeOpacity={finalStrokeOpacity}
                        strokeDasharray={
                            strokeType === "DASHED"
                                ? `${computedStrokeWidth * 3} ${computedStrokeWidth * 2}`
                                : undefined
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect={isCmUnit ? undefined : "non-scaling-stroke"}
                        style={{ pointerEvents: "none" }}
                    />
                </g>
            );
        });
    };


    const renderConnectedSegments = () => {
        if (!selectedPointId || !highlightConnectedSegments) return null;

        // On doit chercher dans le main path ET dans les trous
        const allPaths = [
            { points: annotation.points, map: segmentMap }, // Main
            ...holesData.map(h => ({ points: h.points || annotation.cuts.find(c => c.id === h.id)?.points, map: h.segmentMap })) // Holes
        ];

        const segmentsToDraw = [];

        allPaths.forEach(({ points, map }) => {
            if (!points || !map) return;

            map.forEach(seg => {
                // On récupère les objets points complets via les index
                const pStart = points[seg.startPointIdx];
                const pEnd = points[seg.endPointIdx]; // Attention: seg.endPointIdx peut être un index

                // Vérification : est-ce que ce segment touche le point sélectionné ?
                const isConnected = (pStart?.id === selectedPointId) || (pEnd?.id === selectedPointId);

                if (isConnected) {
                    segmentsToDraw.push(
                        <path
                            key={`highlight-${seg.d}`}
                            d={seg.d}
                            fill="none"
                            stroke={theme.palette.annotation.selected} // La couleur de sélection
                            strokeWidth={(computedStrokeWidth || 2) + 2} // Un peu plus épais pour bien voir
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            style={{ pointerEvents: "none" }} // Purement visuel
                        />
                    );
                }
            });
        });

        return segmentsToDraw;
    };

    // --- LOGIQUE D'AFFICHAGE DES POINTS ---

    // 1. Taille désirée en pixels écran
    const POINT_SIZE = 6;
    const HALF_SIZE = POINT_SIZE / 2;

    const vertexScaleTransform = useMemo(() => {
        // Sécurité pour k
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    // Fonction de rendu d'un vertex
    const renderVertex = (pt) => {
        const isPointSelected = selectedPointId === pt.id;

        // Si le point n'est pas sélectionné, on peut choisir de l'afficher en blanc (petit carré)
        // ou de ne l'afficher que si sélectionné.
        // Pour une bonne UX d'édition, afficher tous les sommets en blanc et le sélectionné en rouge est standard.

        return (
            <g
                key={pt.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                // Important : pointerEvents='all' permet de cliquer dessus même si SnappingLayer est désactivé
                style={{ cursor: isTransient ? 'crosshair' : 'pointer', pointerEvents: 'all' }}
                data-node-type="VERTEX"
                data-point-id={pt.id}
                data-annotation-id={annotation.id}
            >
                <g style={{ transform: vertexScaleTransform }}>
                    <rect
                        x={-HALF_SIZE}
                        y={-HALF_SIZE}
                        width={POINT_SIZE}
                        height={POINT_SIZE}

                        // ROUGE si sélectionné, BLANC avec bordure bleue sinon
                        fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
                        stroke="#2196f3"
                        strokeWidth={1.5}
                    />
                </g>
            </g>
        );
    };

    // On récupère tous les points (Contour principal + Trous)
    const mainPoints = annotation.points || [];

    // Pour les trous (cuts), on doit aplatir les tableaux de points
    const cutPoints = (annotation.cuts || []).flatMap(c => c.points || []);

    const allPoints = [...mainPoints, ...cutPoints];

    const mainPartId = getPartId("MAIN", 0);
    const mainFillStyle = getPartStyle(mainPartId);

    return (
        <g{...dataProps}>
            {/* Hatching Pattern */}
            {showFill && fillType === "HATCHING" && (
                <defs>
                    <pattern
                        id={patternIdRef.current}
                        patternUnits="userSpaceOnUse"
                        width={HATCHING_SPACING}
                        height={HATCHING_SPACING}
                    >
                        <path
                            d={`M 0,${HATCHING_SPACING} L ${HATCHING_SPACING},0`}
                            stroke={fillColor}
                            strokeWidth={1}
                        />
                    </pattern>
                </defs>
            )}

            {/* Fill - Uses combined path (Main + Holes) */}
            {showFill && (
                <path
                    d={fullFillD} // [NEW] Use combined path
                    // fill={fillType === "HATCHING" ? `url(#${patternIdRef.current})` : displayFillColor}
                    fill={fillType === "HATCHING" ? `url(#${patternIdRef.current})` : mainFillStyle?.fill}
                    //fillOpacity={fillOpacity ?? 0.8}
                    fillOpacity={mainFillStyle.fillOpacity ?? fillOpacity}
                    fillRule="evenodd" // [IMPORTANT] Evenodd handles the holes
                    stroke="none"
                    style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                    {...dataProps}
                    onMouseEnter={() => setHoveredPartId(mainPartId)}
                    onMouseLeave={() => setHoveredPartId(null)}
                />
            )}

            {/* [NEW] Hole Gap Fill (Selection Helper) */}
            {/* Renders a semi-transparent fill INSIDE the holes when selected */}
            {/* On affiche ce fond SEULEMENT si sélectionné ET PAS en cours de modification (transient) */}
            {selected && !isTransient && holesData.map((hole, i) => (
                <path
                    key={`hole-fill-${i}`}
                    d={hole.d}
                    fill={displayFillColor}
                    fillOpacity={0.2}
                    stroke="none"
                    style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                    {...dataProps}
                />
            ))}

            {/* Strokes - Main Path */}
            {strokeType !== "NONE" && renderSegments(segmentMap, 'MAIN', 0)}

            {/* [NEW] Strokes - Holes */}
            {strokeType !== "NONE" && holesData.map((hole, i) => (
                <g key={`hole-strokes-${i}`}>
                    {renderSegments(hole.segmentMap, 'CUT', i)}
                </g>
            ))}

            {/* Strokes - Connected Segments */}
            {renderConnectedSegments()}

            {/* RENDU DES POINTS (Seulement si l'annotation est sélectionnée ou 1 point est sélectionné) */}
            {allPoints.map(pt => {
                const isPointSelected = selectedPointId === pt.id;

                // Condition d'affichage :
                // 1. L'annotation entière est sélectionnée (on affiche tout)
                // 2. OU ce point spécifique est sélectionné (on l'affiche seul)
                if (selected || isPointSelected) {
                    return renderVertex(pt);
                }

                return null;
            })}

            {/* [NEW] Label */}
            {showLabel && <NodeLabelStatic
                annotation={labelAnnotation}
                containerK={containerK}
                hidden={!annotation.showLabel}
            />}
        </g>
    );
}