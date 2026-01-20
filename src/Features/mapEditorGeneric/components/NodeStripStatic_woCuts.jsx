import { useMemo, useRef, useState } from "react";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

import NodeLabelStatic from "./NodeLabelStatic";
import offsetPolylineAsPolygon from "Features/geometry/utils/offsetPolylineAsPolygon";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";

// --- CONSTANTES DE STYLE ---
const STYLE_CONSTANTS = {
    COLORS: {
        SELECTED_PART: theme.palette.annotation?.selectedPart || "#ff0000",
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
    containerK,
    forceHideLabel,
    isTransient,
    selectedPointId,
    selectedPartId,
}) {
    // Gestion sélection temporaire
    if (annotation.id.startsWith("temp")) selected = true;

    const [hoveredPartId, setHoveredPartId] = useState(null);
    const mergedAnnotation = { ...annotation, ...annotationOverride };

    // --- PROPS ---
    let {
        id: annotationId,
        points = [],
        strokeColor = theme.palette.secondary.main,
        fillColor = theme.palette.secondary.main,
        fillOpacity = STYLE_CONSTANTS.OPACITIES.FILL_DEFAULT,
        strokeOpacity = STYLE_CONSTANTS.OPACITIES.FILL_DEFAULT,
        strokeWidth = 20,
        strokeWidthUnit = "PX",
        hiddenSegmentsIdx = [],
        stripOrientation = 1,
    } = mergedAnnotation || {};

    const labelAnnotation = getAnnotationLabelPropsFromAnnotation(mergedAnnotation);
    const showLabel = (mergedAnnotation.showLabel || selected) && !forceHideLabel;

    if (!strokeColor) strokeColor = theme.palette.secondary.main;
    if (!fillColor) fillColor = theme.palette.secondary.main;

    const commonDataProps = {
        "data-node-id": annotationId,
        "data-node-listing-id": mergedAnnotation.listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "STRIP",
    };

    // --- 1. CALCUL GEOMETRIE : FILL (LE RUBAN) ---
    const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;
    const computedDistance = useMemo(() => {
        if (isCmUnit) return (strokeWidth * 0.01) / baseMapMeterByPx * stripOrientation;
        return strokeWidth * stripOrientation;
    }, [strokeWidth, strokeWidthUnit, baseMapMeterByPx, isCmUnit, stripOrientation]);

    const stripPolygons = useMemo(() => {
        if (!points || points.length < 2) return [];

        const chunks = [];
        let currentChunk = [points[0]];

        for (let i = 0; i < points.length - 1; i++) {
            if (hiddenSegmentsIdx.includes(i)) {
                if (currentChunk.length > 1) chunks.push(currentChunk);
                currentChunk = [points[i + 1]];
            } else {
                currentChunk.push(points[i + 1]);
            }
        }
        if (currentChunk.length > 1) chunks.push(currentChunk);

        return chunks.map((chunkPoints, i) => {
            const polyPoints = offsetPolylineAsPolygon(chunkPoints, computedDistance);
            if (!polyPoints || polyPoints.length === 0) return null;
            return {
                id: `strip-poly-${i}`,
                d: polyPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ") + " Z"
            };
        }).filter(Boolean);
    }, [points, hiddenSegmentsIdx, computedDistance]);


    // --- 2. CALCUL GEOMETRIE : STROKE (LES SEGMENTS DIRECTEURS) ---
    const directorSegments = useMemo(() => {
        if (!points || points.length < 2) return [];
        const segs = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            segs.push({
                index: i,
                d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
                isHidden: hiddenSegmentsIdx.includes(i)
            });
        }
        return segs;
    }, [points, hiddenSegmentsIdx]);


    // --- HELPERS STYLE (MODE ÉDITION SEULEMENT) ---
    const getFillStyle = () => {
        const isFocusOnSegment = selectedPartId?.includes("SEG") || (hoveredPartId && hoveredPartId.includes("SEG"));
        if (isFocusOnSegment) {
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

    const getSegmentStyle = (segIndex, isHidden) => {
        // NOTE: Cette fonction n'est appelée que si selected=true
        const partId = `${annotationId}::SEG::${segIndex}`;
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

        if (isHovered) return { stroke: darken(strokeColor, 0.2), strokeWidth: 3, opacity: 1 };
        return { stroke: strokeColor, strokeWidth: 2, opacity: 1 };
    };


    // --- RENDER SOMMETS ---
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

    if (!points?.length) return null;

    const fillStyle = getFillStyle();
    const mainPartId = `${annotationId}::MAIN`;

    return (
        <g {...commonDataProps}>

            {/* 1. LAYER FILL */}
            <g
                onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredPartId(mainPartId);
                }}
                onMouseLeave={() => setHoveredPartId(null)}
                data-part-id={selected ? mainPartId : undefined}
                data-node-id={annotationId}
            >
                {stripPolygons.map((poly) => (
                    <path
                        key={poly.id}
                        d={poly.d}
                        fill={fillStyle.fill}
                        fillOpacity={fillStyle.opacity}
                        stroke="none"
                        style={{
                            cursor: isTransient ? "crosshair" : "pointer",
                            transition: "fill 0.2s"
                        }}
                    />
                ))}
            </g>

            {/* 2. LAYER STROKE (DIRECTRICE) */}

            {/* CAS A : MODE VUE (Non sélectionné) -> Ligne Esthétique Fine */}
            {!selected && directorSegments.map((seg, i) => {
                // Si le segment est caché, on ne dessine rien (l'espace est vide)
                if (seg.isHidden) return null;

                return (
                    <path
                        key={`aesthetic-stroke-${i}`}
                        d={seg.d}
                        fill="none"
                        stroke={strokeColor}         // Couleur du fill
                        strokeWidth={STYLE_CONSTANTS.STROKE_WIDTH_DEFAULT}            // 1px
                        vectorEffect="non-scaling-stroke" // Reste fin au zoom
                        style={{ pointerEvents: "none" }} // Ne capte aucun clic
                    />
                );
            })}

            {/* CAS B : MODE ÉDITION (Sélectionné) -> Segments Interactifs */}
            {selected && directorSegments.map((seg) => {
                const style = getSegmentStyle(seg.index, seg.isHidden);
                const partId = `${annotationId}::SEG::${seg.index}`;

                // Si caché et pas sélectionné (cas rare ici car on est dans le bloc selected), 
                // mais getSegmentStyle gère l'affichage Ghost.
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
                        data-node-id={annotationId}
                        style={{ cursor: isTransient ? "crosshair" : "pointer" }}
                    >
                        {/* Zone de clic élargie */}
                        <path
                            d={seg.d}
                            stroke="rgba(0,0,0,0)"
                            strokeWidth={22}
                            fill="none"
                            vectorEffect="non-scaling-stroke"
                            style={{ pointerEvents: 'stroke' }}
                        />

                        {/* Visuel du segment */}
                        <path
                            d={seg.d}
                            fill="none"
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            strokeOpacity={style.opacity}
                            strokeDasharray={style.dash}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            style={{ pointerEvents: "none" }}
                        />
                    </g>
                );
            })}

            {/* 3. ANCHORS */}
            {selected && points.map(pt => renderVertex(pt))}
            {showLabel && <NodeLabelStatic annotation={labelAnnotation} containerK={containerK} hidden={!mergedAnnotation.showLabel} />}
        </g>
    );
}