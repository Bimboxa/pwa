import React, { useMemo, useRef, useLayoutEffect, useState } from "react";
import { Paper, Typography } from "@mui/material";
import { darken } from "@mui/material/styles";

// Dimensions fixes (en pixels écran)
const DOT_RADIUS = 4;
const LINE_WIDTH = 1.5;
const PADDING_X = 8;
const PADDING_Y = 4;

export default function NodeLabelStatic({
    annotation,
    annotationOverride,
    imageSize,
    hovered,
    selected,
    dragged,
    onSizeChange, // <--- NOUVELLE PROP
}) {
    const data = { ...annotation, ...annotationOverride };
    const {
        x, y,
        labelX, labelY,
        width: fixedWidth, // <--- La largeur imposée par le resize (optionnelle)
        textValue,
        fillColor = "#2196f3",
        textColor = "#000000",
        bgColor = "#ffffff",
    } = data;

    // --- 1. COORDONNÉES ---
    const imgW = imageSize?.width || imageSize?.w || 1;
    const imgH = imageSize?.height || imageSize?.h || 1;

    const targetPx = { x: x * imgW, y: y * imgH };
    const labelPx = {
        x: (labelX ?? x) * imgW,
        y: (labelY ?? y) * imgH
    };

    // --- 2. COULEURS & STYLE ---
    const activeColor = hovered ? darken(fillColor, 0.2) : fillColor;
    const borderStyle = selected ? `2px solid ${activeColor}` : `1px solid ${activeColor}`;
    const elevation = selected ? 4 : 1;

    // --- 3. MESURE ET REDIMENSIONNEMENT ---
    const [labelSize, setLabelSize] = useState({ w: 60, h: 30 });
    const textRef = useRef(null);

    // Ref pour éviter la boucle infinie (Maximum update depth exceeded)
    const lastNotifiedSize = useRef({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!textRef.current) return;
        const el = textRef.current;

        const updateSize = () => {
            // On mesure la taille réelle du DOM (qui dépend du texte et du fixedWidth)
            const realWidth = el.offsetWidth;
            const realHeight = el.offsetHeight;

            // Mise à jour locale pour centrer le foreignObject
            setLabelSize({ w: realWidth, h: realHeight });

            // Notification au parent (EditedLabelLayer) seulement si changement significatif
            if (
                onSizeChange &&
                (Math.abs(lastNotifiedSize.current.width - realWidth) > 1 ||
                    Math.abs(lastNotifiedSize.current.height - realHeight) > 1)
            ) {
                lastNotifiedSize.current = { width: realWidth, height: realHeight };
                onSizeChange({ width: realWidth, height: realHeight });
            }
        };

        // Mesure initiale
        updateSize();

        // Observer les changements (ex: le texte wrap parce que la width a changé)
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);

        return () => ro.disconnect();
    }, [textValue, fixedWidth, onSizeChange, selected]);
    // fixedWidth est important ici : si la props change, la hauteur peut changer (wrap)

    // --- 4. RENDU ---

    const dataProps = {
        "data-node-id": annotation.id,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "LABEL",
    };

    return (
        <g {...dataProps} style={{ cursor: dragged ? "grabbing" : "pointer" }}>

            {/* A. LE TRAIT */}
            <line
                x1={targetPx.x} y1={targetPx.y}
                x2={labelPx.x} y2={labelPx.y}
                stroke={activeColor}
                strokeWidth={LINE_WIDTH}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
            />

            {/* B. LE POINT CIBLE */}
            <g transform={`translate(${targetPx.x}, ${targetPx.y})`}>
                <g style={{
                    transform: `scale(calc(1 / var(--map-zoom, 1)))`,
                    transformBox: "fill-box", transformOrigin: "center"
                }}>
                    <circle
                        r={DOT_RADIUS}
                        fill={activeColor}
                        stroke="white"
                        strokeWidth={1}
                        pointerEvents="visible"
                        data-part-type="TARGET"
                    />
                    <circle r={10} fill="transparent" stroke="transparent" data-part-type="TARGET" />
                </g>
            </g>

            {/* C. L'ÉTIQUETTE */}
            <g transform={`translate(${labelPx.x}, ${labelPx.y})`}>
                <g style={{
                    transform: `scale(calc(1 / var(--map-zoom, 1)))`
                }}>
                    <foreignObject
                        x={-labelSize.w / 2}
                        y={-labelSize.h / 2}
                        width={labelSize.w}
                        height={labelSize.h}
                        style={{ overflow: 'visible' }}
                    >
                        <Paper
                            ref={textRef}
                            elevation={elevation}
                            sx={{
                                // LOGIQUE DE DIMENSIONNEMENT :
                                // Si fixedWidth existe, on l'utilise et on autorise le wrap.
                                // Sinon, on s'adapte au contenu sur une seule ligne.
                                width: fixedWidth ? `${fixedWidth}px` : 'max-content',
                                whiteSpace: fixedWidth ? 'normal' : 'nowrap',
                                wordBreak: 'break-word', // Coupe les mots longs si nécessaire

                                bgcolor: bgColor,
                                border: borderStyle,
                                borderRadius: '4px',
                                padding: `${PADDING_Y}px ${PADDING_X}px`,
                                pointerEvents: 'auto',
                                userSelect: 'none',
                                textAlign: 'center',
                                minWidth: '20px',
                                boxSizing: 'border-box' // Important pour que width inclue le padding
                            }}
                            data-part-type="LABEL_BOX"
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    color: textColor,
                                    fontWeight: 'bold',
                                    lineHeight: 1.2,
                                    display: 'block'
                                }}
                            >
                                {textValue || "Étiquette"}
                            </Typography>
                        </Paper>
                    </foreignObject>
                </g>
            </g>

        </g>
    );
}