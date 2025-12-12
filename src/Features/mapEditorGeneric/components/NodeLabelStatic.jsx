import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import { darken } from "@mui/material/styles";
import db from "App/db/db"; // ⚠️ Assurez-vous que le chemin est correct selon votre projet

// --- CONSTANTES (Base en pixels) ---
const DOT_RADIUS = 4;
const LINE_WIDTH = 1.5;
const PADDING_X = 8;
const PADDING_Y = 4;
const DEFAULT_FONT_SIZE = 14;

export default function NodeLabelStatic({
    annotation,
    annotationOverride,
    imageSize,
    hovered,
    selected, // Sert de flag "edited"
    dragged,
    onSizeChange,

    // PROPS IDENTIQUES À NodeMarkerStatic
    showBgImage = false,
    sizeVariant: propSizeVariant,
    containerK = 1,
}) {

    const data = { ...annotation, ...annotationOverride };
    const {
        targetPoint = { x: 0, y: 0 },
        labelPoint = { x: 0, y: 0 },
        width: fixedWidth,
        label,
        fillColor = "#2196f3",
        textColor = "#000000",
        bgColor = "#ffffff",
        fontSize = DEFAULT_FONT_SIZE,
    } = data;

    // --- 1. DÉTERMINATION DU MODE DE TAILLE ---
    const sizeVariant = "FIXED_IN_CONTAINER_PARENT"

    // --- 2. CALCUL DE L'ÉCHELLE (SCALE) ---
    const scaleTransform = useMemo(() => {
        const k = containerK || 1;

        switch (sizeVariant) {
            case "FIXED_IN_SCREEN":
                return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;

            case "FIXED_IN_CONTAINER_PARENT":
                return `scale(${1 / k})`;

            case "SCALED":
            default:
                return "scale(1)";
        }
    }, [sizeVariant, containerK]);

    // --- 3. COORDONNÉES ---
    const imgW = imageSize?.width || imageSize?.w || 1;
    const imgH = imageSize?.height || imageSize?.h || 1;

    const targetPx = { x: targetPoint.x * imgW, y: targetPoint.y * imgH };
    const labelPx = {
        x: (labelPoint.x ?? targetPoint.x) * imgW,
        y: (labelPoint.y ?? targetPoint.y) * imgH
    };

    // --- 4. GESTION DU TEXTE ET DB ---
    const [localValue, setLocalValue] = useState(label || "");

    // Sync si la prop change depuis l'extérieur (ex: undo/redo)
    useEffect(() => {
        setLocalValue(label || "");
    }, [label]);

    // Sauvegarde en DB au Blur
    const handleBlur = async () => {
        if (localValue !== label) {
            console.log("💾 Saving Annotation Label:", annotation.id, localValue);
            try {
                await db.annotations.update(annotation.id, { label: localValue });
            } catch (err) {
                console.error("Error updating label:", err);
            }
        }
    };

    // Gestion du curseur à la fin lors du focus
    const handleFocus = (e) => {
        const val = e.target.value;
        // Place le curseur à la fin du texte
        e.target.setSelectionRange(val.length, val.length);
    };

    const handleKeyDown = (e) => {
        e.stopPropagation(); // Empêche les raccourcis globaux (ex: suppression de noeud)

        // Validation avec Entrée (sans Shift)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.target.blur(); // Déclenche le save
        }
    };

    // --- 5. STYLE & COULEURS ---
    const activeColor = hovered ? darken(fillColor, 0.2) : fillColor;
    const borderStyle = selected ? `2px solid ${activeColor}` : `1px solid ${activeColor}`;

    const boxShadow = selected
        ? "0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)"
        : "0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)";


    // --- 6. MESURE DU DOM (Shadow Box Logic) ---
    const [labelSize, setLabelSize] = useState({ w: 60, h: 30 });
    const textRef = useRef(null);
    const lastNotifiedSize = useRef({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!textRef.current) return;
        const el = textRef.current;

        const updateSize = () => {
            // On ajoute une petite marge de sécurité pour éviter le scrollbar au moment de la frappe
            const realWidth = el.offsetWidth + (selected ? 4 : 0);
            const realHeight = el.offsetHeight;
            setLabelSize({ w: realWidth, h: realHeight });

            if (
                onSizeChange &&
                (Math.abs(lastNotifiedSize.current.width - realWidth) > 1 ||
                    Math.abs(lastNotifiedSize.current.height - realHeight) > 1)
            ) {
                lastNotifiedSize.current = { width: realWidth, height: realHeight };
                onSizeChange({ width: realWidth, height: realHeight });
            }
        };

        updateSize();
        // Le ResizeObserver surveille le span invisible qui contient le texte
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);
        return () => ro.disconnect();
    }, [localValue, fixedWidth, onSizeChange, selected, fontSize, sizeVariant]);

    // --- 7. RENDU ---
    const dataProps = {
        "data-node-id": annotation.id,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "LABEL",
    };

    const fontStyles = {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        lineHeight: 1.2,
        textAlign: 'center',
        whiteSpace: fixedWidth ? 'pre-wrap' : 'pre', // 'pre' permet au shadow span de garder les espaces
        wordBreak: 'break-word',
    };

    return (
        <g {...dataProps} style={{ cursor: dragged ? "grabbing" : "pointer" }}>

            {/* A. LIGNE DE LIAISON */}
            <line
                x1={targetPx.x} y1={targetPx.y}
                x2={labelPx.x} y2={labelPx.y}
                stroke={activeColor}
                strokeWidth={LINE_WIDTH}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
            />

            {/* 1. LIGNE FANTÔME (Zone de clic élargie) */}
            <line
                x1={targetPx.x} y1={targetPx.y}
                x2={labelPx.x} y2={labelPx.y}
                stroke="transparent"
                strokeWidth={15}
                vectorEffect="non-scaling-stroke"
                style={{
                    cursor: selected ? "move" : "pointer",
                    pointerEvents: "stroke"
                }}
                data-part-type="LINK"
            />

            {/* B. CIBLE (Target Point) */}
            <g transform={`translate(${targetPx.x}, ${targetPx.y})`}>
                <g style={{
                    transform: scaleTransform,
                    transformBox: "fill-box",
                    transformOrigin: "center"
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

            {/* C. ÉTIQUETTE (Label Box) */}
            <g transform={`translate(${labelPx.x}, ${labelPx.y})`}>
                <g style={{ transform: scaleTransform }}>
                    <foreignObject
                        x={-labelSize.w / 2}
                        y={-labelSize.h / 2}
                        width={labelSize.w}
                        height={labelSize.h}
                        style={{ overflow: 'visible' }}
                    >
                        <div
                            ref={textRef} // On observe la taille de ce conteneur
                            xmlns="http://www.w3.org/1999/xhtml"
                            data-part-type="LABEL_BOX"
                            style={{
                                width: fixedWidth ? `${fixedWidth}px` : 'max-content',
                                minWidth: '40px', // Largeur min pour pouvoir cliquer si vide
                                height: 'auto',
                                backgroundColor: bgColor,
                                border: borderStyle,
                                borderRadius: '4px',
                                boxShadow: boxShadow,
                                boxSizing: 'border-box',
                                padding: `${PADDING_Y}px ${PADDING_X}px`,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative', // Nécessaire pour l'absolute du textarea
                                pointerEvents: 'auto',
                                userSelect: 'none',
                            }}
                            // IMPORTANT : Stop propagation pour pouvoir sélectionner le texte sans draguer la map
                            onMouseDown={(e) => {
                                if (selected) e.stopPropagation();
                            }}
                        >
                            {/* 1. SHADOW SPAN (Invisible, pilote la taille) */}
                            {/* Il contient le texte pour pousser les murs de la div parente */}
                            <span style={{
                                ...fontStyles,
                                color: 'transparent',
                                visibility: 'hidden',
                                height: '100%',
                                display: 'block',
                                minHeight: '1.2em'
                            }}>
                                {localValue || " "}
                            </span>

                            {/* 2. LOGIQUE D'AFFICHAGE (Input vs Text) */}
                            {selected ? (
                                <textarea
                                    value={localValue}
                                    onChange={(e) => setLocalValue(e.target.value)}
                                    onBlur={handleBlur}
                                    onFocus={handleFocus} // <--- Place le curseur à la fin
                                    onKeyDown={handleKeyDown}
                                    // Pas d'autoFocus : l'utilisateur doit cliquer pour éditer
                                    style={{
                                        ...fontStyles,
                                        position: 'absolute',
                                        top: `${PADDING_Y}px`,
                                        left: `${PADDING_X}px`,
                                        width: `calc(100% - ${PADDING_X * 2}px)`,
                                        height: `calc(100% - ${PADDING_Y * 2}px)`,
                                        color: textColor,
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        resize: 'none',
                                        padding: 0,
                                        margin: 0,
                                        overflow: 'hidden',
                                        cursor: 'text'
                                    }}
                                />
                            ) : (
                                // Mode Lecture seule
                                <span style={{
                                    ...fontStyles,
                                    position: 'absolute',
                                    color: textColor,
                                    pointerEvents: 'none' // Laisse le clic traverser vers la div
                                }}>
                                    {label || "Étiquette"}
                                </span>
                            )}
                        </div>
                    </foreignObject>
                </g>
            </g>
        </g>
    );
}