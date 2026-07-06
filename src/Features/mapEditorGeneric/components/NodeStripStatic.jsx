import { useMemo, useRef, useState } from "react";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

import NodeLabelStatic from "./NodeLabelStatic";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import { typeOf, circleFromThreePoints } from "Features/geometry/utils/arcSampling";

const HATCHING_SPACING = 12;

// --- CONSTANTES DE STYLE ---
const STYLE_CONSTANTS = {
    COLORS: {
        SELECTED_PART: theme.palette.annotation?.selectedPart || "#ff0000",
        CUT_SELECTED: "#2196f3",
        CONTEXT: "rgba(0,0,0,0.4)",
        GHOST: theme.palette.text.disabled || "#ccc",
    },
    OPACITIES: {
        FILL_DEFAULT: 0.7,
        FILL_CONTEXT: 0.4,
        STROKE_DEFAULT: 1,
        STROKE_CONTEXT: 0.3,
        GHOST_STROKE: 0.8,
    },
    STROKE_WIDTH_DEFAULT: 2,
};

export default function NodeStripStatic({
    annotation,
    annotationOverride,
    hovered,
    selected,
    baseMapMeterByPx,
    baseMapImageScale = 1,
    containerK,
    forceHideLabel,
    isTransient,
    selectedPointId,
    selectedPointIds = [],
    selectedPartId,
}) {
    // Gestion sélection temporaire
    if (annotation.id.startsWith("temp")) selected = true;

    const [hoveredPartId, setHoveredPartId] = useState(null);
    const mergedAnnotation = { ...annotation, ...annotationOverride };
    const isForBaseMaps = mergedAnnotation.isForBaseMaps;

    const patternIdRef = useRef(`strip-hatching-${Math.random().toString(36).substr(2, 9)}`);

    // --- PROPS ---
    let {
        id: annotationId,
        points = [],
        cuts = [],
        strokeColor = theme.palette.secondary.main,
        fillColor = theme.palette.secondary.main,
        fillOpacity = STYLE_CONSTANTS.OPACITIES.FILL_DEFAULT,
        strokeOpacity = STYLE_CONSTANTS.OPACITIES.FILL_DEFAULT,
        strokeType,
        hiddenSegmentsIdx = [],
    } = mergedAnnotation || {};

    const labelAnnotation = getAnnotationLabelPropsFromAnnotation(mergedAnnotation);
    const showLabel = (mergedAnnotation.showLabel) && !forceHideLabel;

    if (!strokeColor) strokeColor = theme.palette.secondary.main;
    if (!fillColor) fillColor = theme.palette.secondary.main;

    const commonDataProps = {
        "data-node-id": annotationId,
        "data-node-entity-id": mergedAnnotation.entityId,
        "data-node-listing-id": mergedAnnotation.listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "STRIP",
    };

    // --- 1. CALCUL GEOMETRIE : PATHS DES CUTS (Mode Édition / Stroke) ---
    const cutPaths = useMemo(() => {
        if (!cuts || cuts.length === 0) return [];
        return cuts.map((cut) => {
            if (!cut.points || cut.points.length < 2) return null;
            return cut.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ") + " Z";
        }).filter(Boolean);
    }, [cuts]);


    // --- 2. CALCUL GEOMETRIE : FILL (LE RUBAN) ---
    // Utilisation de la fonction isolée
    const stripPolygonsData = useMemo(() => {
        // SI !selected : On calcule l'intersection réelle (Vue propre)
        // SI selected : On garde la forme brute + cuts originaux (pour édition cohérente)
        const polygons = getStripePolygons(mergedAnnotation, baseMapMeterByPx, !selected);

        // Transformation en SVG Path (d)
        return polygons.map((shape, i) => {
            const mainPath = shape.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ") + " Z";

            const holesPath = (shape.cuts || []).map(c => {
                if (!c.points || c.points.length < 3) return "";
                return c.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ") + " Z";
            }).join(" ");

            return {
                id: `strip-poly-${i}`,
                d: mainPath + " " + holesPath // Concaténation pour fill-rule="evenodd"
            };
        });

    }, [mergedAnnotation, baseMapMeterByPx, selected]);


    // --- 3. CALCUL GEOMETRIE : STROKE (LES SEGMENTS DIRECTEURS) ---
    const _closeLine = mergedAnnotation.closeLine;
    const directorSegments = useMemo(() => {
        if (!points || points.length < 2) return [];
        const n = points.length;
        const types = points.map(typeOf);

        // Build the SVG `d` for the director segment points[i] → points[i+1].
        // A square→circle→square (S-C-S) triplet renders as two arc halves so the
        // centerline follows the curve (like NodePolylineStatic) instead of
        // peaking at the control point. Each half keeps its own segment index, so
        // selection / hover / hidden handling is unchanged.
        const segPath = (i) => {
            const a = points[i];
            const b = points[i + 1];
            const straight = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
            let triplet = null;
            if (types[i] === "square" && types[i + 1] === "circle" && types[i + 2] === "square") {
                triplet = [a, b, points[i + 2]]; // first half: square → circle
            } else if (types[i] === "circle" && types[i + 1] === "square" && types[i - 1] === "square") {
                triplet = [points[i - 1], a, b]; // second half: circle → square
            }
            if (!triplet) return straight;
            const circ = circleFromThreePoints(triplet[0], triplet[1], triplet[2]);
            if (!circ || !Number.isFinite(circ.r) || circ.r <= 0 || circ.r > 100000) {
                return straight; // collinear / quasi-flat → straight fallback
            }
            const [P0, P1, P2] = triplet;
            // Same triplet for both halves → identical sweep → continuous arc.
            const cross = (P1.x - P0.x) * (P2.y - P0.y) - (P1.y - P0.y) * (P2.x - P0.x);
            const sweep = cross > 0 ? 1 : 0;
            return `M ${a.x} ${a.y} A ${circ.r} ${circ.r} 0 0 ${sweep} ${b.x} ${b.y}`;
        };

        const segs = [];
        for (let i = 0; i < n - 1; i++) {
            segs.push({
                index: i,
                d: segPath(i),
                isHidden: hiddenSegmentsIdx.includes(i)
            });
        }
        // Add closing segment for closed strips (kept straight: a seam arc would
        // need wrap-around triplet detection and is not a real use case here).
        if (_closeLine && n >= 3) {
            const last = points[n - 1];
            const first = points[0];
            if (last.x !== first.x || last.y !== first.y) {
                segs.push({
                    index: n - 1,
                    d: `M ${last.x} ${last.y} L ${first.x} ${first.y}`,
                    isHidden: hiddenSegmentsIdx.includes(n - 1)
                });
            }
        }
        return segs;
    }, [points, hiddenSegmentsIdx, _closeLine]);


    // --- HATCHING ---
    const useHatching = strokeType === "DASHED";
    const patternTransformStyle = useMemo(() => {
        if (isForBaseMaps) return undefined;
        const k = containerK || 1;
        return { transform: `scale(calc(1 / (var(--map-zoom, 1) * ${k})))` };
    }, [containerK, isForBaseMaps]);

    // --- HELPERS STYLE ---
    const getFillStyle = () => {
        const isFocusOnPart = selectedPartId?.includes("SEG") || selectedPartId?.includes("CUT") || (hoveredPartId && (hoveredPartId.includes("SEG") || hoveredPartId.includes("CUT")));
        if (isFocusOnPart) {
            return {
                fill: STYLE_CONSTANTS.COLORS.CONTEXT,
                opacity: STYLE_CONSTANTS.OPACITIES.FILL_CONTEXT
            };
        }
        const isMainHovered = hoveredPartId === `${annotationId}::MAIN`;
        if (isMainHovered && !isTransient) {
            return { fill: darken(strokeColor, 0.2), opacity: STYLE_CONSTANTS.OPACITIES.FILL_CONTEXT };
        }
        return { fill: strokeColor, opacity: strokeOpacity };
    };

    // isExt strips (exterior-side guides for the auto-drawing algorithms)
    // draw their MAIN director line in the same fluo-cyan as the per-segment
    // "Segment extérieur" markers, instead of the band color.
    const directorColor = mergedAnnotation.isExt ? "#00e5ff" : strokeColor;

    const getSegmentStyle = (segIndex, isHidden) => {
        const partId = `${annotationId}::SEG::${segIndex}`;
        if (!selected) return { stroke: "none", strokeWidth: 0, opacity: 0 };

        const isSelected = selectedPartId === partId;
        const isHovered = hoveredPartId === partId;

        // A. GHOST
        if (isHidden) {
            if (isSelected) return { stroke: STYLE_CONSTANTS.COLORS.SELECTED_PART, strokeWidth: 3, opacity: 1, dash: "4 12" };
            if (isHovered) return { stroke: darken(strokeColor, 0.2), strokeWidth: 3, opacity: 1, dash: "4 12" };
            return { stroke: STYLE_CONSTANTS.COLORS.GHOST, strokeWidth: 2, opacity: STYLE_CONSTANTS.OPACITIES.GHOST_STROKE, dash: "4 12" };
        }

        // B. STANDARD
        if (selectedPartId) {
            if (isSelected) return { stroke: STYLE_CONSTANTS.COLORS.SELECTED_PART, strokeWidth: 3, opacity: 1 };
            if (isHovered) return { stroke: darken(STYLE_CONSTANTS.COLORS.CONTEXT, 0.4), strokeWidth: 3, opacity: 1 };
            return { stroke: STYLE_CONSTANTS.COLORS.CONTEXT, strokeWidth: 2, opacity: STYLE_CONSTANTS.OPACITIES.STROKE_CONTEXT };
        }

        if (isHovered) return { stroke: darken(directorColor, 0.2), strokeWidth: 3, opacity: 1 };
        return { stroke: directorColor, strokeWidth: 2, opacity: 1 };
    };

    const getCutStyle = (index) => {
        const partId = `${annotationId}::CUT::${index}`;
        const isSelected = selectedPartId === partId;
        const isHovered = hoveredPartId === partId;

        if (isSelected) return { stroke: STYLE_CONSTANTS.COLORS.CUT_SELECTED, strokeWidth: 3 };
        if (isHovered) return { stroke: darken(STYLE_CONSTANTS.COLORS.CUT_SELECTED, 0.2), strokeWidth: 3 };

        if (selectedPartId) return { stroke: STYLE_CONSTANTS.COLORS.CONTEXT, strokeWidth: 2 };

        return { stroke: strokeColor, strokeWidth: 2 };
    };


    // --- RENDER SOMMETS ---
    const POINT_SIZE = 6;
    const HALF_SIZE = POINT_SIZE / 2;
    const vertexScaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    const renderVertex = (pt) => {
        const isPointSelected = selectedPointId === pt.id || selectedPointIds.includes(pt.id);
        const isCircle = pt.type === "circle";
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
                    {isCircle ? (
                        <circle
                            cx={0} cy={0} r={HALF_SIZE}
                            fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
                            stroke="#2196f3"
                            strokeWidth={1.5}
                        />
                    ) : (
                        <rect
                            x={-HALF_SIZE} y={-HALF_SIZE} width={POINT_SIZE} height={POINT_SIZE}
                            fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
                            stroke="#2196f3"
                            strokeWidth={1.5}
                        />
                    )}
                </g>
            </g>
        );
    };

    if (!points?.length) return null;

    const fillStyle = getFillStyle();
    const mainPartId = `${annotationId}::MAIN`;

    const stripFill = useHatching ? `url(#${patternIdRef.current})` : null;

    return (
        <g {...commonDataProps}>

            {/* HATCHING PATTERN DEF */}
            {useHatching && (
                <defs>
                    <pattern
                        id={patternIdRef.current}
                        patternUnits="userSpaceOnUse"
                        width={HATCHING_SPACING}
                        height={HATCHING_SPACING}
                        style={patternTransformStyle}
                    >
                        <path
                            d={`M 0,${HATCHING_SPACING} L ${HATCHING_SPACING},0`}
                            stroke={strokeColor}
                            strokeWidth={2}
                        />
                    </pattern>
                </defs>
            )}

            {/* 1. LAYER FILL (Strip + Cuts via evenodd) */}
            <g
                onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredPartId(mainPartId);
                }}
                onMouseLeave={() => setHoveredPartId(null)}
                data-part-id={selected ? mainPartId : undefined}
                data-part-type="MAIN"
                data-node-id={annotationId}
            >
                {stripPolygonsData.map((poly) => (
                    <path
                        key={poly.id}
                        d={poly.d}
                        fill={stripFill ?? fillStyle.fill}
                        fillOpacity={fillStyle.opacity}
                        fillRule="evenodd"
                        stroke="none"
                        style={{
                            cursor: isTransient ? "crosshair" : "pointer",
                            transition: "fill 0.2s"
                        }}
                    />
                ))}
            </g>

            {/* 2. LAYER STROKE (DIRECTRICE) - NON SÉLECTIONNÉ */}
            {!selected && directorSegments.map((seg, i) => {
                if (seg.isHidden) return null;
                return (
                    <path
                        key={`aesthetic-stroke-${i}`}
                        d={seg.d}
                        fill="none"
                        stroke={directorColor}
                        strokeWidth={isForBaseMaps ? STYLE_CONSTANTS.STROKE_WIDTH_DEFAULT * (baseMapImageScale || 1) : STYLE_CONSTANTS.STROKE_WIDTH_DEFAULT}
                        vectorEffect={isForBaseMaps ? undefined : "non-scaling-stroke"}
                        style={{ pointerEvents: "none" }}
                    />
                );
            })}

            {/* 3. LAYER STROKE (DIRECTRICE) - SÉLECTIONNÉ */}
            {selected && directorSegments.map((seg) => {
                const style = getSegmentStyle(seg.index, seg.isHidden);
                const partId = `${annotationId}::SEG::${seg.index}`;

                if (seg.isHidden && !selected) return null;
                if (!style || style.opacity === 0) return null;

                return (
                    <g
                        key={`seg-${seg.index}`}
                        onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredPartId(partId);
                        }}
                        onMouseLeave={() => setHoveredPartId(null)}
                        data-part-id={partId}
                        data-part-type="SEG"
                        data-node-id={annotationId}
                        style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                    >
                        {selected && (
                            <path
                                d={seg.d}
                                stroke="rgba(0,0,0,0)"
                                strokeWidth={22}
                                fill="none"
                                vectorEffect={isForBaseMaps ? undefined : "non-scaling-stroke"}
                                style={{ pointerEvents: 'stroke' }}
                            />
                        )}
                        <path
                            d={seg.d}
                            fill="none"
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            strokeOpacity={style.opacity}
                            strokeDasharray={style.dash}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect={isForBaseMaps ? undefined : "non-scaling-stroke"}
                            style={{ pointerEvents: "none" }}
                        />
                    </g>
                );
            })}

            {/* 4. LAYER CUTS (STROKES) - SÉLECTIONNÉ UNIQUEMENT */}
            {selected && cutPaths.map((d, i) => {
                const style = getCutStyle(i);
                const partId = `${annotationId}::CUT::${i}`;

                return (
                    <g
                        key={`cut-${i}`}
                        onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredPartId(partId);
                        }}
                        onMouseLeave={() => setHoveredPartId(null)}
                        data-part-id={partId}
                        data-part-type="CUT"
                        data-node-id={annotationId}
                        style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                    >
                        <path
                            d={d}
                            stroke="rgba(0,0,0,0)"
                            strokeWidth={14}
                            fill="none"
                            vectorEffect={isForBaseMaps ? undefined : "non-scaling-stroke"}
                            style={{ pointerEvents: 'stroke' }}
                        />
                        <path
                            d={d}
                            fill="none"
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            vectorEffect={isForBaseMaps ? undefined : "non-scaling-stroke"}
                            style={{ pointerEvents: "none" }}
                        />
                    </g>
                );
            })}

            {/* 5. ANCHORS */}
            {selected && points.map(pt => renderVertex(pt))}

            {showLabel && <NodeLabelStatic annotation={labelAnnotation} containerK={containerK} hidden={!mergedAnnotation.showLabel} />}
        </g>
    );
}