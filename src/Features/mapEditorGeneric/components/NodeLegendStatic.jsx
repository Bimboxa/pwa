import { memo, useLayoutEffect, useRef, useState } from "react";
import { Polyline, Pentagon as Polygon, Rectangle, Square, Circle, Texture } from "@mui/icons-material";

import theme from "Styles/theme";

import useObject3DTopView from "Features/object3D/hooks/useObject3DTopView";

import getStrokeDasharray from "Features/mapEditorGeneric/utils/getStrokeDasharray";

// Offset line glyph: page pt of the line → glyph px, as if the glyph were a
// 16 pt wide sample of the plan; kept readable and inside the glyph.
const OFFSET_LINE_GLYPH_WIDTH_PT = 16;
// STRIP glyph: thickness of the line, as a ratio of the glyph size (thicker
// than the POLYLINE one).
const STRIP_GLYPH_THICKNESS_RATIO = 0.2;
// POLYLINE glyph: thickness when the stroke is not in screen px (CM strokes
// have no meaningful size in the legend), and largest thickness drawn.
const POLYLINE_GLYPH_DEFAULT_WIDTH_PX = 2;
const POLYLINE_GLYPH_MAX_THICKNESS_RATIO = 0.15;

// OBJECT_3D legend glyph: the top view, painted in the template color2D
// (« Représentation 2D ») when set.
function Object3DTopViewImage({ topViewDataUrl, color2D }) {
    const src = useObject3DTopView({ topViewDataUrl }, { color: color2D });
    return (
        <img
            src={src}
            alt=""
            style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
            }}
        />
    );
}

export default memo(function NodeLegendStatic({
    id = "legend",
    legendItems = [],
    spriteImage,
    legendFormat, // { x, y, width, fontSize? } in BG-local units
    hovered,
    selected,
    onSizeChange,
    showQty = false,
    qtiesById,
    // CSS background of the legend box (capture: opaque white).
    background = "rgba(255,255,255,0.92)",
}) {
    const { x = 16, y = 16, width = 260, fontSize = 18 } = legendFormat ?? {};

    // --- dataProps ---
    const dataProps = {
        "data-node-id": id,
        "data-node-type": "LEGEND",
    };

    // ===== measure content height to set foreignObject height correctly
    const contentRef = useRef(null);

    const lastNotifiedSize = useRef({ width: 0, height: 0 });

    const [measuredCssH, setMeasuredCssH] = useState(1);

    useLayoutEffect(() => {
        if (!contentRef.current) return;
        const el = contentRef.current;

        const updateSize = () => {
            // On mesure la boîte réelle
            const realWidth = el.offsetWidth;
            const realHeight = el.offsetHeight; // ou el.scrollHeight si overflow

            // On compare avec la dernière valeur envoyée
            if (
                Math.abs(lastNotifiedSize.current.width - realWidth) > 1 ||
                Math.abs(lastNotifiedSize.current.height - realHeight) > 1
            ) {
                // Seulement si ça a changé significativement (>1px)
                lastNotifiedSize.current = { width: realWidth, height: realHeight };
                setMeasuredCssH(realHeight);

                if (onSizeChange) {
                    onSizeChange({ width: realWidth, height: realHeight });
                }
            }
        };

        // Mesure initiale
        updateSize();

        // On observe
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);

        return () => ro.disconnect();
    }, [legendItems, width, fontSize, onSizeChange, showQty]); // width est la prop imposée

    const widthLocal = width;
    const heightLocal = Math.max(1, measuredCssH);

    // ===== visuals constants (scale with fontSize)
    const ICON_PX = Math.round(fontSize * 2);
    const ROW_GAP = Math.round(fontSize * 0.33);
    const PADDING = Math.round(fontSize * 0.56);

    const {
        url,
        tile = 32,
        columns = 3,
        rows = 3,
        iconKeys = [],
    } = spriteImage || {};

    // Helper Icon Component (Statique)
    function LegendIcon({ type, iconKey, fillColor, strokeColor, fillType, strokeType, variant, topViewDataUrl, color2D, offsetLine, strokeWidth, strokeWidthUnit }) {
        const commonStyle = {
            width: `${ICON_PX}px`,
            height: `${ICON_PX}px`,
            //borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
        };

        const muiIconStyle = {
            fill: fillColor,
            fontSize: ICON_PX * 0.8, // FORCE LA TAILLE EN PIXELS
            width: ICON_PX * 0.8,     // Sécurité supplémentaire pour html-to-image
            height: ICON_PX * 0.8
        };

        // Line glyph shared by every linear item (offset line, POLYLINE,
        // STRIP): same span, and for a dashed line the same rule — the
        // pattern of the plan ([dash, gap] in glyph px), shortened so the
        // glyph shows three dashes at least.
        function renderLineGlyph({ color, lineWidth, pattern }) {
            const x1 = ICON_PX * 0.1;
            const x2 = ICON_PX * 0.9;
            let strokeDasharray;
            if (pattern) {
                const [dash, gap] = pattern;
                const dashK = Math.min(1, (x2 - x1) / (2.5 * dash + 2 * gap));
                strokeDasharray = `${dash * dashK} ${gap * dashK}`;
            }
            return (
                <div style={{ ...commonStyle, background: "white" }}>
                    <svg width={ICON_PX} height={ICON_PX} viewBox={`0 0 ${ICON_PX} ${ICON_PX}`}>
                        <line
                            x1={x1}
                            y1={ICON_PX / 2}
                            x2={x2}
                            y2={ICON_PX / 2}
                            stroke={color}
                            strokeWidth={lineWidth}
                            strokeDasharray={strokeDasharray}
                        />
                    </svg>
                </div>
            );
        }

        // "Ligne de déport" drawn on the plan: the glyph is that line (color,
        // thickness, dashes) instead of the glyph of the type.
        if (offsetLine) {
            const k = ICON_PX / OFFSET_LINE_GLYPH_WIDTH_PT;
            return renderLineGlyph({
                color: offsetLine.color,
                lineWidth: Math.min(
                    Math.max(offsetLine.strokeWidth * k, 1),
                    ICON_PX / 3
                ),
                pattern: offsetLine.dashed
                    ? getStrokeDasharray(offsetLine.strokeWidth)
                        .split(" ")
                        .map((v) => Number(v) * k)
                    : null,
            });
        }

        if (type === "POLYLINE") {
            // The line as drawn on the plan: its screen thickness when the
            // stroke is in px, and its dashes.
            const isPxUnit = (strokeWidthUnit ?? "PX") !== "CM";
            const width = Number(strokeWidth);
            const lineWidth = Math.min(
                Math.max(
                    isPxUnit && width > 0 ? width : POLYLINE_GLYPH_DEFAULT_WIDTH_PX,
                    1
                ),
                ICON_PX * POLYLINE_GLYPH_MAX_THICKNESS_RATIO
            );
            return renderLineGlyph({
                color: strokeColor,
                lineWidth,
                pattern:
                    strokeType === "DASHED"
                        ? getStrokeDasharray(lineWidth).split(" ").map(Number)
                        : null,
            });
        }

        if (type === "POLYGON") {
            return (
                <div style={{
                    ...commonStyle, background: "white",
                    //border: `2px solid ${strokeColor}`
                }}>
                    {/*<Polygon style={{ fill: fillColor, scale: 0.8 }} />*/}
                    {fillType === "HATCHING" && <Texture style={{ ...muiIconStyle }} />}
                    {(fillType === "SOLID" || !fillType) && <Rectangle style={{ ...muiIconStyle }} />}
                </div>
            );
        }

        if (type === "STRIP") {
            // a band is a linear item: a thick line, not a surface
            return renderLineGlyph({
                color: strokeColor,
                lineWidth: ICON_PX * STRIP_GLYPH_THICKNESS_RATIO,
            });
        }

        if (type === "LINEAR_LAYOUT") {
            return (
                <div style={{
                    ...commonStyle, background: "white",
                }}>
                    <Rectangle style={{ ...muiIconStyle, fill: strokeColor }} />
                </div>
            );
        }

        if (type === "RECTANGLE") {
            return (
                <div style={{
                    ...commonStyle, background: "white",
                    //border: `2px solid ${fillColor}`
                }}>
                    <Rectangle style={{ ...muiIconStyle }} />
                </div>
            );
        }

        if (type === "OBJECT_3D") {
            return (
                <div style={{ ...commonStyle, background: "white" }}>
                    {topViewDataUrl ? (
                        <Object3DTopViewImage
                            topViewDataUrl={topViewDataUrl}
                            color2D={color2D}
                        />
                    ) : (
                        <Square style={{ ...muiIconStyle }} />
                    )}
                </div>
            );
        }

        if (type === "POINT") {
            const resolvedVariant = variant || "CIRCLE";
            return (
                <div style={{
                    ...commonStyle, background: "white"
                }}>
                    {resolvedVariant === "CIRCLE" && <Circle style={{ ...muiIconStyle }} />}
                    {resolvedVariant === "SQUARE" && <Square style={{ ...muiIconStyle }} />}
                </div>
            );
        }

        // Marker sprite
        const idx = Math.max(0, iconKeys.indexOf(iconKey));
        const row = Math.floor(idx / columns);
        const col = idx % columns;

        return (
            <div style={{ ...commonStyle, borderRadius: "50%", background: fillColor || "#f44336" }}>
                {url && (
                    <svg
                        width={ICON_PX * 0.8}
                        height={ICON_PX * 0.8}
                        viewBox={`${col * tile} ${row * tile} ${tile} ${tile}`}
                    >
                        <image
                            href={url}
                            width={columns * tile}
                            height={rows * tile}
                            preserveAspectRatio="none"
                        />
                    </svg>
                )}
            </div>
        );
    }

    // Si pas d'items, on n'affiche rien
    if (!legendItems?.length) return null;

    return (
        <g>
            <foreignObject
                x={x}
                y={y}
                width={widthLocal}
                height={heightLocal}
                {...dataProps}
                style={{ overflow: "visible", pointerEvents: 'auto' }} // Static = pas d'interaction
            >
                <div
                    ref={contentRef}
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background,
                        border: "1px solid rgba(0,0,0,0.15)",
                        borderRadius: 8,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        padding: PADDING,
                        display: "flex",
                        fontFamily: theme.typography.fontFamily,
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: showQty ? `${ICON_PX}px 1fr auto` : `${ICON_PX}px 1fr`,
                            rowGap: ROW_GAP,
                            columnGap: 10,
                            alignContent: "start",
                            width: "100%",
                        }}
                    >
                        {legendItems.map((it, i) => {
                            // Section title
                            if (it.type === "listingName") {
                                return (
                                    <div key={i} style={{ display: "contents" }}>
                                        <div style={{ gridColumn: "1 / -1" }}>
                                            <div
                                                style={{
                                                    fontWeight: "bold",
                                                    fontSize,
                                                    marginTop: i > 0 ? ROW_GAP * 2 : 0,
                                                    marginBottom: ROW_GAP,
                                                    color: "#333"
                                                }}
                                            >
                                                {it.name}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Group label header
                            if (it.type === "groupLabel") {
                                return (
                                    <div key={i} style={{ display: "contents" }}>
                                        <div style={{ gridColumn: "1 / -1" }}>
                                            <div
                                                style={{
                                                    fontSize: fontSize * 0.75,
                                                    fontWeight: 500,
                                                    textTransform: "uppercase",
                                                    letterSpacing: 0.5,
                                                    marginTop: i > 0 ? ROW_GAP : 0,
                                                    marginBottom: ROW_GAP * 0.5,
                                                    color: "#999",
                                                }}
                                            >
                                                {it.name}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Group divider
                            if (it.type === "groupDivider") {
                                return (
                                    <div key={i} style={{ display: "contents" }}>
                                        <div style={{ gridColumn: "1 / -1" }}>
                                            <div
                                                style={{
                                                    borderTop: "1px solid #ddd",
                                                    marginTop: ROW_GAP * 0.5,
                                                    marginBottom: ROW_GAP * 0.5,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            }

                            // Legend item
                            return (
                                <div key={i} style={{ display: "contents" }}>
                                    <div style={{ alignSelf: "start" }}>
                                        <LegendIcon
                                            type={it.type}
                                            variant={it.variant}
                                            iconKey={it.iconType ?? it.iconKey}
                                            fillColor={it.fillColor}
                                            strokeColor={it.strokeColor}
                                            strokeType={it.strokeType}
                                            fillType={it.fillType}
                                            closeLine={it.closeLine}
                                            topViewDataUrl={it.topViewDataUrl}
                                            color2D={it.color2D}
                                            offsetLine={it.offsetLine}
                                            strokeWidth={it.strokeWidth}
                                            strokeWidthUnit={it.strokeWidthUnit}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            alignSelf: "center",
                                            overflowWrap: "anywhere",
                                            wordBreak: "break-word",
                                            lineHeight: 1.25,
                                            fontSize,
                                            color: "#444"
                                        }}
                                    >
                                        {it.label}
                                    </div>
                                    {showQty && (
                                        <div
                                            style={{
                                                alignSelf: "center",
                                                whiteSpace: "nowrap",
                                                fontSize: fontSize * 0.85,
                                                fontFamily: "monospace",
                                                fontWeight: 500,
                                                color: "#666",
                                                textAlign: "right",
                                            }}
                                        >
                                            {qtiesById?.[it.id]?.mainQtyLabel ?? ""}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </foreignObject>
            {hovered && (
                <rect
                    x={x}
                    y={y}
                    width={widthLocal}
                    height={heightLocal}
                    fill="none"
                    stroke={theme.palette.baseMap.hovered}
                    strokeWidth={2}
                    pointerEvents="none"
                    vectorEffect="non-scaling-stroke"
                />
            )}
        </g>
    );
});