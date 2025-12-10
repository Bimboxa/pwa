import { memo, useLayoutEffect, useRef, useState } from "react";
import { Polyline, Pentagon as Polygon, Rectangle } from "@mui/icons-material";

import theme from "Styles/theme";

export default memo(function NodeLegendStatic({
    id = "legend",
    legendItems = [],
    spriteImage,
    legendFormat, // { x, y, width, fontSize? } in BG-local units
    hovered,
    selected,
}) {
    const { x = 16, y = 16, width = 260, fontSize = 18 } = legendFormat ?? {};

    // --- dataProps ---
    const dataProps = {
        "data-node-id": id,
        "data-node-type": "LEGEND",
    };

    // ===== measure content height to set foreignObject height correctly
    const contentRef = useRef(null);
    const [measuredCssH, setMeasuredCssH] = useState(1);

    useLayoutEffect(() => {
        if (!contentRef.current) return;
        const el = contentRef.current;

        // Mesure immédiate
        setMeasuredCssH(el.scrollHeight);

        // Observer pour réagir aux changements de layout (ex: chargement fonts)
        const ro = new ResizeObserver(() => {
            if (el) setMeasuredCssH(el.scrollHeight);
        });
        ro.observe(el);

        return () => ro.disconnect();
    }, [legendItems, width, fontSize]); // Dépendances importantes pour recalculer la hauteur

    const widthLocal = width;
    const heightLocal = Math.max(1, measuredCssH);

    // ===== visuals constants
    const ICON_PX = 36;
    const ROW_GAP = 6;
    const PADDING = 10;

    const {
        url,
        tile = 32,
        columns = 3,
        rows = 3,
        iconKeys = [],
    } = spriteImage || {};

    // Helper Icon Component (Statique)
    function LegendIcon({ type, iconKey, fillColor, strokeColor, closeLine }) {
        const commonStyle = {
            width: `${ICON_PX}px`,
            height: `${ICON_PX}px`,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
        };

        if (type === "POLYLINE") {
            return (
                <div style={{ ...commonStyle, background: "white", border: `2px solid ${strokeColor}` }}>
                    <Polyline style={{ fill: strokeColor, scale: 0.8 }} />
                </div>
            );
        }

        if (type === "POLYGON") {
            return (
                <div style={{ ...commonStyle, background: "white", border: `2px solid ${strokeColor}` }}>
                    <Polygon style={{ fill: fillColor, scale: 0.8 }} />
                </div>
            );
        }

        if (type === "RECTANGLE") {
            return (
                <div style={{ ...commonStyle, background: "white", border: `2px solid ${fillColor}` }}>
                    <Rectangle style={{ fill: fillColor, scale: 0.7 }} />
                </div>
            );
        }

        // Marker sprite
        const idx = Math.max(0, iconKeys.indexOf(iconKey));
        const row = Math.floor(idx / columns);
        const col = idx % columns;

        return (
            <div style={{ ...commonStyle, background: fillColor || "#f44336" }}>
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
                        background: "rgba(255,255,255,0.92)",
                        border: "1px solid rgba(0,0,0,0.15)",
                        borderRadius: 8,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        padding: PADDING,
                        display: "flex",
                        // Reset CSS pour garantir le rendu SVG propre
                        fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: `${ICON_PX}px 1fr`,
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

                            // Legend item
                            return (
                                <div key={i} style={{ display: "contents" }}>
                                    <div style={{ alignSelf: "start" }}>
                                        <LegendIcon
                                            type={it.type}
                                            iconKey={it.iconType ?? it.iconKey}
                                            fillColor={it.fillColor}
                                            strokeColor={it.strokeColor}
                                            closeLine={it.closeLine}
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