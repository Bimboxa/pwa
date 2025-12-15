import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

const BORDER_WIDTH = 2;
const HANDLE_SIZE_PX = 8;

export default function EditedTextLayer({
    text,               // L'objet annotation (similaire à 'text' dans NodeTextStatic)
    imageSize,          // { width, height }
    containerK = 1,     // Zoom global (pour l'échelle des poignées si besoin)
    onUpdate,           // Callback (id, changes) -> ex: db.annotations.update
}) {
    const theme = useTheme();

    // --- 1. LOCAL STATE ---
    // On garde la valeur locale pour la fluidité de la frappe
    const [localValue, setLocalValue] = useState(text.textValue || "");
    const [boxDimensions, setBoxDimensions] = useState({ w: 0, h: 0 });

    const contentRef = useRef(null);
    const textareaRef = useRef(null);

    // --- 2. STYLE & PROPS (Réplique exacte de NodeTextStatic) ---
    const fontFamily = text.fontFamily ?? "inherit";
    const fontWeight = text.fontWeight ?? "normal";
    const fontSizePx = text.fontSize ?? 16;
    const paddingPx = 8;
    const minWidthPx = 28;
    const minHeightPx = fontSizePx * 1.25;
    const fillColor = text.fillColor;
    const fillOpacity = text.fillOpacity ?? 1;

    // Couleur de sélection
    const selectedColor = theme.palette.annotation?.selected || theme.palette.primary.main;

    // --- 3. POSITIONNEMENT (Logique NodeTextStatic) ---
    // NodeTextStatic aligne :
    // X : Bord gauche (moins bordure)
    // Y : Centre vertical
    const pixelX = (text.x ?? 0) * (imageSize?.width ?? 0);
    const pixelY = (text.y ?? 0) * (imageSize?.height ?? 0);

    // --- 4. MEASURE (Shadow DOM Logic) ---
    // Cette partie est CRITIQUE : on mesure le contenu réel pour ajuster la hauteur du textarea
    useLayoutEffect(() => {
        if (!contentRef.current) return;

        const measure = () => {
            const el = contentRef.current;
            // Hauteur du contenu (scroll height)
            const contentH = Math.max(el.scrollHeight, minHeightPx + paddingPx);

            // Largeur : Si on a une largeur imposée (resize), on l'utilise.
            // Sinon on prend la largeur du contenu (offset)
            let contentW = el.offsetWidth;

            // Si width est défini dans l'objet, c'est lui qui gagne
            if (text.width) {
                contentW = text.width;
            }

            setBoxDimensions({ w: contentW, h: contentH });
        };

        measure();
        // On observe aussi les changements de taille (ex: wrap du texte)
        const ro = new ResizeObserver(measure);
        ro.observe(contentRef.current);
        return () => ro.disconnect();
    }, [localValue, text.width, fontSizePx, paddingPx, minHeightPx]);


    // --- 5. DIMENSIONS FINALES (Box + Borders) ---
    // On doit ajouter les bordures aux dimensions mesurées, comme dans NodeTextStatic
    const finalBoxW = boxDimensions.w + (BORDER_WIDTH * 2);
    const finalBoxH = boxDimensions.h + (BORDER_WIDTH * 2);

    // Compensation Position (Idem NodeTextStatic)
    const adjustedX = pixelX - BORDER_WIDTH;
    const adjustedY = pixelY - (finalBoxH / 2);


    // --- 6. HANDLERS ---
    const handleChange = (e) => setLocalValue(e.target.value);

    const handleBlur = () => {
        if (localValue !== text.textValue) {
            onUpdate?.(text.id, { textValue: localValue });
        }
    };

    const handleKeyDown = (e) => {
        e.stopPropagation(); // Bloque les raccourcis map
        // Note: On laisse "Enter" faire un saut de ligne standard
        if (e.key === "Escape") {
            e.target.blur();
        }
    };

    const stopProp = (e) => e.stopPropagation();


    // --- 7. STYLES CSS PARTAGÉS ---
    // Ces styles doivent être identiques pour le span (mesure) et le textarea (input)
    // pour garantir que le texte ne saute pas.
    const textStyle = {
        fontFamily,
        fontSize: fontSizePx,
        fontWeight,
        lineHeight: 1.25,
        letterSpacing: "inherit",
        padding: `${paddingPx / 2}px ${paddingPx}px`,
        margin: 0,
        boxSizing: 'border-box',
        whiteSpace: text.width ? "pre-wrap" : "pre", // Wrap si largeur fixée
        wordWrap: "break-word",
        display: "block",
        width: "100%",
        minHeight: "100%",
        overflow: "hidden",
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

    // --- 8. HELPERS (Poignées) ---

    // Poignée de Resize (Est / Ouest)
    const ResizeHandle = ({ type, left, top }) => (
        <div
            style={{
                position: 'absolute',
                left, top,
                width: HANDLE_SIZE_PX,
                height: HANDLE_SIZE_PX,
                backgroundColor: 'white',
                border: `1px solid ${selectedColor}`,
                cursor: 'ew-resize',
                pointerEvents: 'auto',
                zIndex: 10,
                transform: 'translate(-50%, -50%)'
            }}
            data-interaction="transform-text" // <--- Nouvelle interaction à gérer
            data-handle-type={type}
            onMouseDown={stopProp}
        />
    );

    // Poignée de Drag (Haut Gauche)
    const DragHandle = () => (
        <div
            style={{
                position: 'absolute',
                left: -16,
                top: -8,
                cursor: 'move',
                color: selectedColor,
                pointerEvents: 'auto',
                zIndex: 20,
                padding: 4,
                backgroundColor: 'rgba(255,255,255,0.7)',
                borderRadius: '50%'
            }}
            data-interaction="draggable" // <--- Interaction existante !
            data-node-id={text.id}       // Lier à l'ID
            onMouseDown={stopProp}       // Important: on laisse InteractionLayer gérer via capture, mais on bloque le click textarea
        >
            <DragIndicatorIcon style={{ fontSize: 16, display: 'block' }} />
        </div>
    );

    return (
        <foreignObject
            x={adjustedX}
            y={adjustedY}
            width={finalBoxW}
            height={finalBoxH}
            style={{ overflow: "visible", pointerEvents: "auto" }}
        >
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>

                {/* A. POIGNÉE DE DRAG (Haut Gauche) */}
                <DragHandle />

                {/* B. BOITE CONTENEUR */}
                <Box
                    sx={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                        bgcolor: getBackgroundColor(),
                        border: `${BORDER_WIDTH}px solid ${selectedColor}`,
                        borderRadius: "4px",
                        boxSizing: "border-box",
                        display: 'flex',
                        alignItems: 'flex-start'
                    }}
                >
                    {/* C. SHADOW SPAN (Invisible - Donne la taille) */}
                    {/* Il est rendu "visible" pour le layout, mais caché visuellement */}
                    <span
                        ref={contentRef}
                        style={{
                            ...textStyle,
                            visibility: 'hidden', // Caché mais prend de la place
                            // Si width est fixée, on la force, sinon auto
                            width: text.width ? `${text.width}px` : 'max-content',
                            minWidth: `${minWidthPx}px`,
                        }}
                    >
                        {/* On ajoute un caractère espace pour garantir la hauteur si vide */}
                        {localValue || " "}
                    </span>

                    {/* D. TEXTAREA (Input réel - Overlay) */}
                    <textarea
                        ref={textareaRef}
                        value={localValue}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        // On bloque la propagation du Drag map quand on est dans le texte
                        onMouseDown={stopProp}
                        style={{
                            ...textStyle,
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            color: 'black', // Ou text.color
                        }}
                    />

                    {/* E. RESIZE HANDLES */}
                    {/* Milieu Droit (Est) */}
                    <ResizeHandle type="E" left="100%" top="50%" />
                    {/* Milieu Gauche (Ouest) */}
                    <ResizeHandle type="W" left="0%" top="50%" />

                </Box>
            </div>
        </foreignObject>
    );
}