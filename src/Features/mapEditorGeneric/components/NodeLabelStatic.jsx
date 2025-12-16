import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import { darken } from "@mui/material/styles";
import { IconButton } from "@mui/material";
import { Refresh, Visibility, VisibilityOff } from "@mui/icons-material";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import db from "App/db/db";

// --- CONSTANTES ---
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
    selected,
    dragged,
    onSizeChange,
    containerK = 1,
}) {

    // data

    const updateEntity = useUpdateEntity();
    const updateAnnotation = useUpdateAnnotation();


    // helpers

    const data = { ...annotation, ...annotationOverride };
    const {
        id,
        targetPoint = { x: 0, y: 0 },
        labelPoint = { x: 0, y: 0 },
        width: fixedWidth,
        label,
        placeholder = "Étiquette",
        fillColor = "#2196f3",
        textColor = "#000000",
        bgColor = "#ffffff",
        fontSize = DEFAULT_FONT_SIZE,
        hidden,
    } = data;

    // --- 1. MODE DE TAILLE ---
    const sizeVariant = "FIXED_IN_CONTAINER_PARENT";

    // --- 2. SCALE ---
    const scaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(${1 / k})`;
    }, [containerK]);

    // --- 3. COORDONNÉES ---
    const imgW = imageSize?.width || 1;
    const imgH = imageSize?.height || 1;

    const targetPx = { x: targetPoint.x * imgW, y: targetPoint.y * imgH };
    const labelPx = {
        x: (labelPoint.x ?? targetPoint.x) * imgW,
        y: (labelPoint.y ?? targetPoint.y) * imgH
    };

    // --- 4. GESTION TEXTE ---
    const [localValue, setLocalValue] = useState(label || "");

    useEffect(() => {
        setLocalValue(label || "");
    }, [label]);

    const handleBlur = async () => {
        if (localValue !== label) {
            console.log("💾 Update Label:", id, localValue);
            try {
                if (id.startsWith("label::")) {
                    const annotationId = id.replace("label::", "");
                    const annotation = await db.annotations.get(annotationId);
                    await updateEntity(annotation.entityId, { label: localValue });
                } else {
                    await db.annotations.update(id, { label: localValue });
                }

            } catch (err) { console.error(err); }
        }
    };

    const handleFocus = (e) => {
        const val = e.target.value;
        e.target.setSelectionRange(val.length, val.length);
    };

    const handleKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.target.blur();
        }
    };

    // --- NOUVEAUX HANDLERS ---
    const handleResetDelta = async (e) => {
        e.stopPropagation();
        // Reset labelPoint to null/undefined or to targetPoint
        // Selon votre modèle, supprimer labelPoint force le fallback sur targetPoint
        const annotationId = id.replace("label::", "");
        const annotation = await db.annotations.get(annotationId);
        console.log("Reset delta for label:", annotationId, annotation);
        await db.annotations.update(annotationId, { labelDelta: { target: { x: 0, y: 0 }, label: { x: 0, y: 0 } } });
    };

    const handleToggleHide = async (e) => {
        try {
            e.stopPropagation();
            const annotationId = id.replace("label::", "");
            const annotation = await db.annotations.get(annotationId);
            console.log("Toggle hide label:", annotationId, annotation);
            await db.annotations.update(annotationId, { showLabel: !annotation.showLabel });
        } catch (err) { console.error(err); }
    };

    // --- 5. STYLE & COULEURS ---
    const activeColor = hovered ? darken(fillColor, 0.2) : fillColor;

    // Logique de bordure (Tirets si caché et sélectionné)
    let borderStyle = `1px solid ${activeColor}`;
    if (selected) {
        if (hidden) {
            borderStyle = `2px dashed ${activeColor}`;
        } else {
            borderStyle = `2px solid ${activeColor}`;
        }
    }

    const boxShadow = selected
        ? "0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)"
        : "0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)";

    // --- 6. MESURE DOM ---
    const [labelSize, setLabelSize] = useState({ w: 60, h: 30 });
    const textRef = useRef(null);
    const lastNotifiedSize = useRef({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!textRef.current) return;
        const el = textRef.current;
        const updateSize = () => {
            const realWidth = el.offsetWidth + (selected ? 4 : 0);
            const realHeight = el.offsetHeight;
            setLabelSize({ w: realWidth, h: realHeight });

            if (onSizeChange &&
                (Math.abs(lastNotifiedSize.current.width - realWidth) > 1 ||
                    Math.abs(lastNotifiedSize.current.height - realHeight) > 1)) {
                lastNotifiedSize.current = { width: realWidth, height: realHeight };
                onSizeChange({ width: realWidth, height: realHeight });
            }
        };
        updateSize();
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);
        return () => ro.disconnect();
    }, [localValue, fixedWidth, onSizeChange, selected, fontSize, sizeVariant]);

    // --- 7. RENDU ---
    const dataProps = {
        "data-node-id": id,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "LABEL",
    };

    const fontStyles = {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        lineHeight: 1.2,
        textAlign: 'center',
        whiteSpace: fixedWidth ? 'pre-wrap' : 'pre',
        wordBreak: 'break-word',
    };

    // Si caché et non sélectionné, on n'affiche rien (ou juste le point ?)
    // Adaptez selon votre besoin. Ici j'affiche quand même si sélectionné.
    if (hidden && !selected && !hovered) {
        // Optionnel : ne rien rendre du tout
        // return null; 
        // OU rendre juste le point cible discret
    }

    return (
        <g {...dataProps} style={{
            cursor: dragged ? "grabbing" : "pointer",
            //opacity: hidden && !selected ? 0.5 : 1
        }}>

            {/* A. LIAISON */}
            <line
                x1={targetPx.x} y1={targetPx.y}
                x2={labelPx.x} y2={labelPx.y}
                stroke={activeColor}
                strokeWidth={LINE_WIDTH}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                strokeDasharray={hidden ? "4 4" : "none"} // Tirets aussi sur la ligne si caché
            />

            {/* Ligne fantôme */}
            <line
                x1={targetPx.x} y1={targetPx.y}
                x2={labelPx.x} y2={labelPx.y}
                stroke="transparent"
                strokeWidth={15}
                style={{ cursor: selected ? "move" : "pointer", pointerEvents: "stroke" }}
                data-part-type="LINK"
            />

            {/* B. CIBLE */}
            <g transform={`translate(${targetPx.x}, ${targetPx.y})`}>
                <g style={{ transform: scaleTransform, transformBox: "fill-box", transformOrigin: "center" }}>
                    <circle r={DOT_RADIUS} fill={activeColor} stroke="white" strokeWidth={1} pointerEvents="visible" data-part-type="TARGET" />
                    <circle r={10} fill="transparent" stroke="transparent" data-part-type="TARGET" />
                </g>
            </g>

            {/* C. LABEL BOX */}
            <g transform={`translate(${labelPx.x}, ${labelPx.y})`}>
                <g style={{ transform: scaleTransform }}>
                    <foreignObject
                        x={-labelSize.w / 2}
                        y={-labelSize.h / 2}
                        // On garde la largeur stricte de la boîte pour le foreignObject
                        // Les boutons dépasseront visuellement (overflow visible)
                        width={labelSize.w}
                        height={labelSize.h}
                        style={{ overflow: 'visible' }}
                    >
                        <div
                            ref={textRef}
                            data-part-type="LABEL_BOX"
                            style={{
                                width: fixedWidth ? `${fixedWidth}px` : 'max-content',
                                minWidth: '40px',
                                height: 'auto',
                                backgroundColor: bgColor,
                                border: borderStyle, // Applique le style (tiret ou plein)
                                borderRadius: '4px',
                                boxShadow: boxShadow,
                                boxSizing: 'border-box',
                                padding: `${PADDING_Y}px ${PADDING_X}px`,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                                pointerEvents: 'auto',
                                userSelect: 'none',
                            }}
                            onMouseDown={(e) => selected && e.stopPropagation()}
                        >
                            {/* --- BOUTONS D'ACTION (Visibles si sélectionné) --- */}
                            {selected && (
                                <div style={{
                                    position: 'absolute',
                                    right: -28, // Décalé à droite
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                    pointerEvents: 'auto'
                                }}>
                                    {/* Reset Delta */}
                                    <div
                                        onClick={handleResetDelta}
                                        title="Reset Position"
                                        style={{
                                            cursor: 'pointer',
                                            background: 'white',
                                            borderRadius: '50%',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                            width: 20, height: 20,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <Refresh style={{ fontSize: 14, color: '#666' }} />
                                    </div>

                                    {/* Toggle Hide */}
                                    <div
                                        onClick={handleToggleHide}
                                        title={hidden ? "Show Label" : "Hide Label"}
                                        style={{
                                            cursor: 'pointer',
                                            background: hidden ? '#eee' : 'white',
                                            borderRadius: '50%',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                            width: 20, height: 20,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        {hidden
                                            ? <VisibilityOff style={{ fontSize: 14, color: '#999' }} />
                                            : <Visibility style={{ fontSize: 14, color: '#666' }} />
                                        }
                                    </div>
                                </div>
                            )}

                            {/* Contenu Texte (inchangé) */}
                            <span style={{
                                ...fontStyles,
                                color: 'transparent', visibility: 'hidden',
                                height: '100%', display: 'block', minHeight: '1.2em',
                                minWidth: "60px"
                            }}>
                                {localValue || " "}
                            </span>

                            {selected ? (
                                <textarea
                                    value={localValue}
                                    onChange={(e) => setLocalValue(e.target.value)}
                                    onBlur={handleBlur}
                                    onFocus={handleFocus}
                                    onKeyDown={handleKeyDown}
                                    placeholder={placeholder}
                                    style={{
                                        ...fontStyles,
                                        position: 'absolute', top: `${PADDING_Y}px`, left: `${PADDING_X}px`,
                                        width: `calc(100% - ${PADDING_X * 2}px)`,
                                        height: `calc(100% - ${PADDING_Y * 2}px)`,
                                        color: textColor, background: 'transparent', border: 'none',
                                        outline: 'none', resize: 'none', padding: 0, margin: 0,
                                        overflow: 'hidden', cursor: 'text',
                                        minWidth: "60px"
                                    }}
                                />
                            ) : (
                                <span style={{
                                    ...fontStyles, position: 'absolute', color: textColor, pointerEvents: 'none',
                                    // Grisé si caché en mode lecture
                                    // opacity: hidden ? 0.6 : 1
                                }}>
                                    {label || placeholder}
                                </span>
                            )}
                        </div>
                    </foreignObject>
                </g>
            </g>
        </g>
    );
}