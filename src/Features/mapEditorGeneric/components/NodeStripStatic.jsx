import { memo, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

import NodeLabelStatic from "./NodeLabelStatic";
import NodeSegmentLengthsStatic from "./NodeSegmentLengthsStatic";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import getStripePolygons, {
    getStripChunks,
    getStripDistancePx,
    ARC_SAMPLES,
    STRIP_DASH_DEFAULTS,
} from "Features/geometry/utils/getStripePolygons";
import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";
import { typeOf, circleFromThreePoints, expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Colored dash blocks occupy this fraction of the band width (centered).
const DASH_BAND_RATIO = 0.6;

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

function NodeStripStatic({
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
    selectMode,
    printMode,
    disableVertexEditing = false,
}) {
    // Gestion sélection temporaire
    if (annotation.id.startsWith("temp")) selected = true;

    const [hoveredPartId, setHoveredPartId] = useState(null);
    const mergedAnnotation = { ...annotation, ...annotationOverride };

    // EDIT (Modification) mode — or "no mode" (null) with its segment-drag
    // overlay toggle ON — drives the segment "move" cursor.
    const interactionMode = useSelector(
        (s) => s.popperMapListings?.interactionMode
    );
    const segmentDragEnabled = useSelector(
        (s) => s.mapEditor.segmentDragEnabled
    );
    const isForBaseMaps = mergedAnnotation.isForBaseMaps;

    const clipIdRef = useRef(`strip-hatching-${Math.random().toString(36).substr(2, 9)}`);

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
        // selection / hover / hidden handling is unchanged. On a closed strip the
        // lookups wrap, so a seam arc — "circle" as last point, closing onto the
        // first — renders as an arc too.
        const get = (k) => {
            if (_closeLine) return points[((k % n) + n) % n];
            return k >= 0 && k < n ? points[k] : undefined;
        };
        const ty = (k) => {
            if (_closeLine) return types[((k % n) + n) % n];
            return k >= 0 && k < n ? types[k] : undefined;
        };
        const segPath = (i) => {
            const a = get(i);
            const b = get(i + 1);
            const straight = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
            let triplet = null;
            if (ty(i) === "square" && ty(i + 1) === "circle" && ty(i + 2) === "square") {
                triplet = [a, b, get(i + 2)]; // first half: square → circle
            } else if (ty(i) === "circle" && ty(i + 1) === "square" && ty(i - 1) === "square") {
                triplet = [get(i - 1), a, b]; // second half: circle → square
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
        // Add closing segment for closed strips. segPath wraps, so a seam arc
        // ("circle" as last point) renders its second half as an arc.
        if (_closeLine && n >= 3) {
            const last = points[n - 1];
            const first = points[0];
            if (last.x !== first.x || last.y !== first.y) {
                segs.push({
                    index: n - 1,
                    d: segPath(n - 1),
                    isHidden: hiddenSegmentsIdx.includes(n - 1)
                });
            }
        }
        return segs;
    }, [points, hiddenSegmentsIdx, _closeLine]);


    // --- HATCHING (membrane) ---
    // DASHED strips render as a white band outlined in the stroke color, with
    // colored dash blocks running along the band's centerline (the classic
    // waterproofing-membrane symbol). Dash length/gap are annotation props
    // (dashLength / dashGap, in strokeWidthUnit).
    const useHatching = strokeType === "DASHED";
    const dashLinesData = useMemo(() => {
        if (!useHatching || !points || points.length < 2) return null;
        const distancePx = getStripDistancePx(mergedAnnotation, baseMapMeterByPx);
        if (!distancePx) return null;
        const isCm = mergedAnnotation.strokeWidthUnit === "CM" && baseMapMeterByPx > 0;
        const toPx = (v) => (isCm ? (v * 0.01) / baseMapMeterByPx : v);
        const dashPx = Math.max(1, toPx(Number(mergedAnnotation.dashLength) || STRIP_DASH_DEFAULTS.dashLength));
        const gapPx = Math.max(1, toPx(Number(mergedAnnotation.dashGap) || STRIP_DASH_DEFAULTS.dashGap));
        const { chunks } = getStripChunks(mergedAnnotation);
        const paths = chunks
            .map((chunk) => offsetPolyline(expandArcsInPath(chunk, ARC_SAMPLES, false), distancePx / 2))
            .filter((pts) => pts?.length >= 2)
            .map((pts, i) => ({
                id: `strip-dashes-${i}`,
                d: pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "),
            }));
        return { paths, dashPx, gapPx, bandWidthPx: Math.abs(distancePx) };
    }, [useHatching, mergedAnnotation, baseMapMeterByPx, points]);

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


    // Neon-green highlight for the hovered segment in segment-select mode
    // (matches NodePolylineStatic).
    const SEGMENT_HOVER_COLOR = "#76ff03";

    // --- RENDER SOMMETS ---
    const vertexSizeMultiplier =
        useSelector((s) => s.mapEditor.vertexSizeMultiplier) || 1;
    const POINT_SIZE = 6 * vertexSizeMultiplier;
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

    const stripFill = useHatching ? "#ffffff" : null;

    return (
        <g {...commonDataProps}>

            {/* HATCHING CLIP DEF — keeps the dash blocks inside the band */}
            {useHatching && (
                <defs>
                    <clipPath id={clipIdRef.current} clipPathUnits="userSpaceOnUse">
                        {stripPolygonsData.map((poly) => (
                            <path key={poly.id} d={poly.d} clipRule="evenodd" />
                        ))}
                    </clipPath>
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
                        stroke={useHatching ? strokeColor : "none"}
                        strokeWidth={useHatching ? 1 : 0}
                        strokeOpacity={useHatching ? fillStyle.opacity : 0}
                        vectorEffect={useHatching ? "non-scaling-stroke" : undefined}
                        style={{
                            cursor: isTransient ? "crosshair" : "pointer",
                            transition: "fill 0.2s"
                        }}
                    />
                ))}
                {/* Colored dash blocks along the band centerline */}
                {useHatching && dashLinesData?.paths?.length > 0 && (
                    <g
                        clipPath={`url(#${clipIdRef.current})`}
                        style={{ pointerEvents: "none" }}
                    >
                        {dashLinesData.paths.map((p) => (
                            <path
                                key={p.id}
                                d={p.d}
                                fill="none"
                                stroke={strokeColor}
                                strokeOpacity={fillStyle.opacity}
                                strokeWidth={dashLinesData.bandWidthPx * DASH_BAND_RATIO}
                                strokeDasharray={`${dashLinesData.dashPx} ${dashLinesData.gapPx}`}
                                strokeLinecap="butt"
                            />
                        ))}
                    </g>
                )}
            </g>

            {/* 2. LAYER STROKE (DIRECTRICE) - NON SÉLECTIONNÉ */}
            {!selected && directorSegments.map((seg, i) => {
                if (seg.isHidden) return null;

                const aestheticStrokeWidth = isForBaseMaps
                    ? STYLE_CONSTANTS.STROKE_WIDTH_DEFAULT * (baseMapImageScale || 1)
                    : STYLE_CONSTANTS.STROKE_WIDTH_DEFAULT;

                // Segment-select modes (CUT_SEGMENT / TECHNICAL_RETURN) make the
                // strip clickable per-segment even when it is not selected, so the
                // tools can target a strip directly — mirrors NodePolylineStatic.
                if (selectMode === "SEGMENT") {
                    const partId = `${annotationId}::SEG::${seg.index}`;
                    const isHovered = hoveredPartId === partId;
                    return (
                        <g
                            key={`seg-select-${seg.index}`}
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
                            {/* invisible wide hit area */}
                            <path
                                d={seg.d}
                                stroke="rgba(0,0,0,0)"
                                strokeWidth={22}
                                fill="none"
                                vectorEffect={isForBaseMaps ? undefined : "non-scaling-stroke"}
                                style={{ pointerEvents: "stroke" }}
                            />
                            {/* visible director, highlighted neon-green on hover */}
                            <path
                                d={seg.d}
                                fill="none"
                                stroke={isHovered && !isTransient ? SEGMENT_HOVER_COLOR : directorColor}
                                strokeWidth={isHovered && !isTransient ? aestheticStrokeWidth + 2 : aestheticStrokeWidth}
                                vectorEffect={isForBaseMaps ? undefined : "non-scaling-stroke"}
                                style={{ pointerEvents: "none" }}
                            />
                        </g>
                    );
                }

                return (
                    <path
                        key={`aesthetic-stroke-${i}`}
                        d={seg.d}
                        fill="none"
                        stroke={directorColor}
                        strokeWidth={aestheticStrokeWidth}
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
                        style={{
                            // EDIT mode (or no-mode + segment-drag toggle on
                            // the selected strip): the director segment is
                            // draggable → 4-way move cursor.
                            cursor: isTransient
                                ? "crosshair"
                                : interactionMode === "EDIT" ||
                                    (interactionMode == null &&
                                        segmentDragEnabled &&
                                        selected)
                                    ? "move"
                                    : "pointer",
                        }}
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

            {/* 6. SEGMENT LENGTHS — editable per-segment cotes with lock
                constraints on the director line, EDIT (Modification) mode only. */}
            {selected && !disableVertexEditing && (
                <NodeSegmentLengthsStatic
                    annotation={mergedAnnotation}
                    points={points}
                    closed={Boolean(mergedAnnotation.closeLine)}
                    selected={selected}
                    selectedPointId={selectedPointId}
                    baseMapMeterByPx={baseMapMeterByPx}
                    containerK={containerK}
                    printMode={printMode}
                    isTransient={isTransient}
                    disableVertexEditing={disableVertexEditing}
                />
            )}

            {showLabel && <NodeLabelStatic annotation={labelAnnotation} containerK={containerK} hidden={!mergedAnnotation.showLabel} showElbowHandle={Boolean(selected)} />}
        </g>
    );
}

export default memo(NodeStripStatic);
