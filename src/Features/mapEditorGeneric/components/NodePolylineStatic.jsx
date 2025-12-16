import { useMemo, useRef } from "react";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

import getBarycenter from "Features/geometry/utils/getBarycenter";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";

import NodeLabelStatic from "./NodeLabelStatic";

export default function NodePolylineStatic({
    annotation,
    annotationOverride,
    hovered,
    selected,
    baseMapMeterByPx,
    containerK,
    forceHideLabel,
}) {

    annotation = { ...annotation, ...annotationOverride };

    const showLabel = (annotation.showLabel || selected) && !forceHideLabel;


    // ===== label Annotation =====
    const labelAnnotation = getAnnotationLabelPropsFromAnnotation(annotation);

    let {
        type,
        points = [],
        strokeColor = theme.palette.secondary.main,
        closeLine = type === "POLYGON",
        fillColor = theme.palette.secondary.main,
        fillOpacity = 0.8,
        fillType = "SOLID",
        strokeType = "SOLID",
        strokeOpacity = 1,
        strokeWidth = 2,
        strokeWidthUnit = "PX",
        segments = [],
    } = annotation || {};


    const dataProps = {
        "data-node-id": annotation.id,
        "data-node-listing-id": annotation.listingId, // key for context menu
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "POLYLINE",
    };


    const patternIdRef = useRef(`hatching-${Math.random().toString(36).substr(2, 9)}`);


    strokeColor = type === "POLYGON" ? fillColor : strokeColor;
    if (!strokeColor) strokeColor = theme.palette.secondary.main;
    if (!fillColor) fillColor = theme.palette.secondary.main;

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

    // 1. Calculate the Stroke Width (in Map Pixels) if using physical units
    const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;


    const computedStrokeWidth = useMemo(() => {

        if (type === "POLYGON") {
            return 0.5;
        }

        if (isCmUnit) {
            // CM -> Meters -> Pixels
            // e.g. 20cm = 0.2m. If 1px = 0.01m, then width = 20px.
            return (strokeWidth * 0.01) / baseMapMeterByPx;
        }
        // If PX unit, we pass the raw value (e.g., 2)
        // The browser applies this as screen pixels thanks to non-scaling-stroke
        return strokeWidth;
    }, [strokeWidth, strokeWidthUnit, baseMapMeterByPx, isCmUnit, type]);



    // Helper functions - points are already in absolute coordinates
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

    // Build path - points are already in absolute pixel coordinates
    function buildPathAndMap(absPoints, close) {
        const res = { d: "", segmentMap: [] };
        if (!absPoints?.length) return res;

        const pts = absPoints; // No scaling needed, already absolute
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

    const { d: pathD, segmentMap } = useMemo(
        () => buildPathAndMap(points, closeLine),
        [points, closeLine]
    );

    //const showFill = closeLine && fillType !== "NONE";
    const showFill = type === "POLYGON";
    const HATCHING_SPACING = 12;

    if (!points?.length) return null;
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

            {/* Fill */}
            {showFill && (
                <path
                    d={pathD}
                    fill={fillType === "HATCHING" ? `url(#${patternIdRef.current})` : displayFillColor}
                    fillOpacity={fillOpacity ?? 0.8}
                    fillRule="evenodd"
                    stroke="none"
                    //style={{ pointerEvents: "none" }}
                    style={{ cursor: "pointer" }}
                    {...dataProps}
                />
            )}

            {/* Stroke */}
            {strokeType !== "NONE" &&
                segmentMap.map((seg, idx) => {
                    if (segments[idx]?.isDeleted) return null;

                    return (
                        <g key={`seg-${idx}`}>
                            {/* Hit Area (Transparent & Wider) */}
                            {/* For hit testing, we want a minimum usable size on screen */}
                            <path
                                d={seg.d}
                                fill="none"
                                stroke="transparent"
                                // If Physical: Scale hit area too? Or keep screen-based?
                                // Usually screen-based hit area (14px) is better for UX.
                                strokeWidth={Math.max(14, isCmUnit ? computedStrokeWidth : 14)}
                                style={{ cursor: "pointer" }}
                                vectorEffect={isCmUnit ? undefined : "non-scaling-stroke"}
                                {...dataProps}
                            />

                            {/* Visible Stroke */}
                            <path
                                d={seg.d}
                                fill="none"
                                stroke={displayStrokeColor}
                                strokeWidth={computedStrokeWidth}
                                strokeOpacity={strokeOpacity}
                                strokeDasharray={
                                    strokeType === "DASHED"
                                        ? `${computedStrokeWidth * 3} ${computedStrokeWidth * 2}`
                                        : undefined
                                }
                                strokeLinecap="round"
                                strokeLinejoin="round"

                                // THE FIX: Conditional vector-effect
                                vectorEffect={isCmUnit ? undefined : "non-scaling-stroke"}

                                style={{ pointerEvents: "none" }}
                            />
                        </g>
                    );
                })}

            {showLabel && <NodeLabelStatic
                annotation={labelAnnotation}
                containerK={containerK}
                hidden={!annotation.showLabel}
            />}
        </g>
    );
}