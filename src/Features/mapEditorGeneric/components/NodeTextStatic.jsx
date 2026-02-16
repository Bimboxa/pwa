import React, { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
// Adaptez le chemin d'import selon votre structure
import db from "App/db/db";

// Helper pour estimer la largeur initiale
function estimateWidthPx(str, fontSizePx) {
    const avgChar = 0.6 * fontSizePx;
    return Math.max(1, Math.ceil((str.length + 1) * avgChar));
}

export default function NodeTextStatic({
    text,
    context,
    hovered,
    selected,
    onTextValueChange,
    printMode,
}) {
    const theme = useTheme();

    // --- CONFIGURATION ---
    const BORDER_WIDTH = 2;

    const notText = !(text?.textValue?.length > 0);

    // --- PROPS & DEFAULTS ---
    const fontFamily = text.fontFamily ?? "inherit";
    const fontWeight = text.fontWeight ?? "normal";
    const placeholder = text.placeholder ?? "Texte";
    const fontSizePx = text.fontSize ?? 16;
    const paddingPx = 8;
    const minWidthPx = 28;
    const minHeightPx = fontSizePx * 1.25;
    const fillColor = text.fillColor;
    const fillOpacity = text.fillOpacity ?? 1;

    let textColor = text.textColor || "#000000";
    if (notText) textColor = "#888888";

    // --- COULEURS ---
    const selectedColor = theme.palette.annotation?.selected || theme.palette.primary.main;

    // --- DATA PROPS ---
    const dataProps = {
        "data-node-id": text.id,
        "data-node-entity-id": text.entityId,
        "data-node-listing-id": text.listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "TEXT",
        "data-node-context": context,
        "data-interaction": "draggable",
    };

    // --- STATE ÉDITION ---
    const [localValue, setLocalValue] = useState(text.textValue || "");

    useEffect(() => {
        setLocalValue(text.textValue);
    }, [text.textValue]);

    let textOrPh = localValue?.length > 0 ? localValue : placeholder;
    if (printMode && notText) textOrPh = "";



    // --- DIMENSIONS ---
    const storedWidth = text.width;
    const storedHeight = text.height;

    const contentW = storedWidth
        ? storedWidth
        : Math.max(minWidthPx, estimateWidthPx(textOrPh, fontSizePx)) + paddingPx * 2;

    const contentRef = useRef(null);
    const [measuredCssH, setMeasuredCssH] = useState(minHeightPx + paddingPx);

    useLayoutEffect(() => {
        if (!contentRef.current) return;
        const el = contentRef.current;
        const updateHeight = () => {
            setMeasuredCssH(Math.max(el.scrollHeight, minHeightPx + paddingPx));
        };
        updateHeight();
        const ro = new ResizeObserver(updateHeight);
        ro.observe(el);
        return () => ro.disconnect();
    }, [localValue, storedWidth, minHeightPx, paddingPx, fontSizePx]);

    const finalBoxW = contentW + (BORDER_WIDTH * 2);
    const baseH = storedHeight || measuredCssH;
    const finalBoxH = baseH + (BORDER_WIDTH * 2);

    const pixelX = text.textPoint?.x ?? 0;
    const pixelY = text.textPoint?.y ?? 0;

    const adjustedX = pixelX - BORDER_WIDTH;
    const adjustedY = pixelY - (finalBoxH / 2);

    // --- HANDLERS ---
    const handleBlur = async () => {
        if (localValue !== text.textValue) {
            console.log("💾 Commit Text:", text.id);
            if (onTextValueChange) {
                onTextValueChange({ annotationId: text.id, textValue: localValue });
            } else {
                try {
                    await db.annotations.update(text.id, { textValue: localValue });
                } catch (e) { console.error(e); }
            }
        }
    };

    const handleKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
            e.target.blur();
        }
    };

    const handleMouseDown = (e) => {
        if (selected) e.stopPropagation();
    };

    // --- NOUVEAU : GESTION DU FOCUS ---
    const handleFocus = (e) => {
        // On récupère la longueur du texte actuel
        const val = e.target.value;
        // On place la sélection (le curseur) à la fin
        e.target.setSelectionRange(val.length, val.length);
    };

    // --- STYLES PARTAGÉS ---
    const commonTextStyle = {
        fontFamily,
        fontWeight,
        fontSize: `${fontSizePx}px`,
        lineHeight: 1.25,
        letterSpacing: "inherit",
        color: textColor,
        padding: `${paddingPx / 2}px ${paddingPx}px`,
        margin: 0,
        width: "100%",
        height: "100%",
        boxSizing: 'border-box',
        display: "block",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "break-word",
    };

    const getBackgroundColor = () => {
        if (fillColor) {
            const hex = fillColor.replace("#", "");
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${fillOpacity})`;
        }
        return "transparent";
    };

    return (
        <foreignObject
            x={adjustedX}
            y={adjustedY}
            width={finalBoxW}
            height={finalBoxH}
            style={{ overflow: "visible", pointerEvents: "auto" }}
            {...dataProps}
        >
            <Box
                sx={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    boxSizing: "border-box",
                    bgcolor: getBackgroundColor(),
                    borderStyle: "solid",
                    borderWidth: `${BORDER_WIDTH}px`,
                    borderColor: hovered
                        ? selectedColor
                        : selected
                            ? "rgba(0,0,0,0.1)"
                            : "transparent",
                    borderRadius: "4px",
                    transition: "border-color 0.2s ease",
                }}
            >
                {/* 1. SHADOW SPAN */}
                <span
                    ref={contentRef}
                    style={{
                        ...commonTextStyle,
                        visibility: "hidden",
                        color: 'transparent',
                        minHeight: `${minHeightPx}px`,
                        pointerEvents: 'none',
                        width: contentW ? `${contentW}px` : '100%',
                        height: 'auto', // Fix: Break the loop! Measure content height, not container height.
                    }}
                >
                    {textOrPh}
                    {localValue && localValue.endsWith('\n') && <br />}
                </span>

                {/* 2. OVERLAY (Input ou Texte) */}
                {selected ? (
                    <textarea
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onMouseDown={handleMouseDown}

                        // --- AJOUT ICI ---
                        onFocus={handleFocus} // Déclenche le déplacement du curseur
                        autoFocus             // Focus automatique au montage

                        style={{
                            ...commonTextStyle,
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            overflow: 'hidden',
                        }}
                        spellCheck="false"
                    />
                ) : (
                    <span
                        style={{
                            ...commonTextStyle,
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            pointerEvents: "none"
                        }}
                    >
                        {textOrPh}
                    </span>
                )}
            </Box>
        </foreignObject>
    );
}