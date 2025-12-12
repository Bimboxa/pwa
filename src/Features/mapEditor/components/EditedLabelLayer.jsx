import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useDispatch } from "react-redux";
// Importez vos actions Redux ou db
import db from "App/db/db";

const PADDING_X = 8;
const PADDING_Y = 4;
const DEFAULT_FONT_SIZE = 14;

export default function EditedLabelLayer({
    annotation,          // L'objet annotation complet
    imageSize,           // Taille de l'image (pour conversion coords)
    containerK = 1,      // Zoom actuel (pour inverser l'échelle)
    onClose              // Callback pour fermer l'éditeur (ex: setSelectedNode(null))
}) {
    const [localValue, setLocalValue] = useState(annotation.label || "");
    const textRef = useRef(null);
    const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

    // --- 1. CONFIGURATION IDENTIQUE AU STATIQUE ---
    // On doit répliquer la logique de positionnement pour que ça "pop" au bon endroit
    const sizeVariant = "FIXED_IN_CONTAINER_PARENT";

    // Calcul Position (Copie de NodeLabelStatic)
    const imgW = imageSize?.width || 1;
    const imgH = imageSize?.height || 1;
    const labelPx = {
        x: (annotation.labelPoint?.x ?? annotation.targetPoint.x) * imgW,
        y: (annotation.labelPoint?.y ?? annotation.targetPoint.y) * imgH
    };

    // Calcul Scale (Copie de NodeLabelStatic)
    // On inverse le scale pour que l'input reste à taille humaine
    const scale = 1 / containerK;

    // --- 2. LOGIQUE D'AUTO-SIZE (Shadow Span) ---
    useLayoutEffect(() => {
        if (textRef.current) {
            // On mesure le span caché pour dimensionner le textarea
            setBoxSize({
                w: textRef.current.offsetWidth + 4, // +marge sécu
                h: textRef.current.offsetHeight
            });
        }
    }, [localValue, annotation.width]);

    // --- 3. COMMIT ---
    const handleBlur = async () => {
        if (localValue !== annotation.label) {
            console.log("💾 Commit Label:", annotation.id, localValue);
            await db.annotations.update(annotation.id, { label: localValue });
        }
    };

    const handleKeyDown = (e) => {
        e.stopPropagation(); // Empêche les raccourcis clavier map (suppr, zoom...)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.target.blur(); // Déclenche le save
            if (onClose) onClose();
        }
    };

    // Styles communs
    const fontStyles = {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: `${DEFAULT_FONT_SIZE}px`,
        fontWeight: 'bold',
        lineHeight: 1.2,
        textAlign: 'center',
        whiteSpace: annotation.width ? 'pre-wrap' : 'pre',
        wordBreak: 'break-word',
    };

    return (
        <g transform={`translate(${labelPx.x}, ${labelPx.y})`}>
            <g transform={`scale(${scale})`}>
                <foreignObject
                    x={-boxSize.w / 2}
                    y={-boxSize.h / 2}
                    width={boxSize.w}
                    height={boxSize.h}
                    style={{ overflow: 'visible' }}
                >
                    <div
                        style={{
                            width: annotation.width ? `${annotation.width}px` : 'max-content',
                            minWidth: '40px',
                            backgroundColor: annotation.bgColor || "#ffffff",
                            border: `2px solid #2196f3`, // Bordure bleue d'édition
                            borderRadius: '4px',
                            boxSizing: 'border-box',
                            padding: `${PADDING_Y}px ${PADDING_X}px`,
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'center'
                        }}
                    >
                        {/* SHADOW SPAN (Invisible, pousse la div) */}
                        <span
                            ref={textRef}
                            style={{
                                ...fontStyles,
                                visibility: 'hidden',
                                height: '100%',
                                display: 'block',
                                minHeight: '1.2em'
                            }}
                        >
                            {localValue || " "}
                        </span>

                        {/* INPUT RÉEL (Overlay absolu) */}
                        <textarea
                            value={localValue}
                            onChange={(e) => setLocalValue(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()} // Bloque le drag de la map
                            style={{
                                ...fontStyles,
                                position: 'absolute',
                                top: `${PADDING_Y}px`,
                                left: `${PADDING_X}px`,
                                width: `calc(100% - ${PADDING_X * 2}px)`,
                                height: `calc(100% - ${PADDING_Y * 2}px)`,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                padding: 0,
                                margin: 0,
                                overflow: 'hidden',
                                color: annotation.textColor || "#000"
                            }}
                        />
                    </div>
                </foreignObject>
            </g>
        </g>
    );
}