import { memo, useMemo, useRef } from "react";
import theme from "Styles/theme";

import getRectangleSizeLocks from "Features/rectangles/utils/getRectangleSizeLocks";

// Taille des poignées (pixels écran fixes)
const HANDLE_SIZE = 10;
const HALF_HANDLE = HANDLE_SIZE / 2;
const ROTATION_HANDLE_OFFSET = 30; // Distance de la poignée de rotation (en pixels locaux)

export default memo(function NodeRectangleStatic({
    annotation,
    hovered,
    selected,
    dragged,
    draggedPartType,
    containerK = 1,
    // Multi-selection: selected look only, no resize / rotate / move.
    transformLocked = false,
}) {
    const { bbox, id, fillColor, strokeColor, rotation = 0, fillType = "SOLID", fillOpacity = 1 } = annotation;
    const { x, y, width, height } = bbox ?? {};

    // Template padlocks (one per dimension, see getRectangleSizeLocks). The
    // corner handles stay as long as one dimension is free — the resize
    // ignores the locked one — and disappear when both are locked: the
    // rectangle is then rigid (move + rotate only).
    const { lockedWidth, lockedHeight } = getRectangleSizeLocks(
        annotation.annotationTemplateProps
    );
    const resizeLocked = lockedWidth && lockedHeight;

    // Pattern Id unique
    const patternIdRef = useRef(`hatching-${Math.random().toString(36).substr(2, 9)}`);
    const HATCHING_SPACING = 12;

    // --- 1. CALCUL DE L'ÉCHELLE INVERSE ---
    // Pour garder les poignées de taille constante à l'écran
    const handleScaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    // Props pour le drag global (déplacement du corps)
    const interactionProps = {
        "data-node-id": id,
        "data-node-entity-id": annotation.entityId,
        "data-node-listing-id": annotation.listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "RECTANGLE",
        "data-interaction": "draggable"
    };

    // Style de bordure
    const strokeWidth = 2;

    // Centres pour la rotation
    const cx = width / 2;
    const cy = height / 2;

    // --- 2. CALCUL FILL ---
    let finalFill = fillColor;
    if (fillType === "HATCHING" || fillType === "HATCHING_LEFT") {
        finalFill = `url(#${patternIdRef.current})`;
    }

    // --- 3. HELPERS RENDU POIGNÉES ---

    // Poignée de redimensionnement (Carrée)
    const renderResizeHandle = (type, hx, hy, disabled = false) => (
        <g
            transform={`translate(${hx}, ${hy})`}
            style={{ pointerEvents: disabled ? "none" : "auto" }}
        >
            <g style={{ transform: handleScaleTransform }}>
                <rect
                    x={-HALF_HANDLE}
                    y={-HALF_HANDLE}
                    width={HANDLE_SIZE}
                    height={HANDLE_SIZE}
                    fill={disabled ? "#ccc" : "#fff"}
                    opacity={disabled ? 0.5 : 1}
                    {...(!disabled && {
                        "data-interaction": "resize-annotation",
                        "data-handle-type": type,
                        "data-node-id": id,
                        "data-node-type": "ANNOTATION",
                    })}
                    style={{ cursor: disabled ? "default" : `${type.toLowerCase()}-resize` }}
                    {...selected && {
                        stroke: disabled ? "#999" : "#00ff00",
                        strokeWidth: 1,
                        vectorEffect: "non-scaling-stroke"
                    }}
                />
            </g>
        </g>
    );

    // Poignée de rotation (Ronde, au dessus)
    const renderRotationHandle = () => (
        <g
            transform={`translate(${cx}, ${-ROTATION_HANDLE_OFFSET})`}
            style={{ pointerEvents: "auto" }}
        >
            {/* Ligne de liaison (ne subit pas l'échelle inverse pour rester attachée visuellement) */}
            <line
                x1={0} y1={0}
                x2={0} y2={ROTATION_HANDLE_OFFSET}
                stroke={theme.palette.editor?.selected || "#00ff00"}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
            />

            {/* La poignée ronde */}
            <g style={{ transform: handleScaleTransform }}>
                <circle
                    cx={0} cy={0}
                    r={HALF_HANDLE}
                    fill="#fff"
                    stroke={theme.palette.editor?.selected || "#00ff00"}
                    strokeWidth={1.5}
                    data-interaction="rotate-annotation" // <--- Nouvelle interaction
                    data-node-id={id}
                    data-node-type="ANNOTATION"
                    style={{ cursor: "grab" }}
                />
            </g>
        </g>
    );

    // Angle badge shown while rotating (counter-rotated to stay readable)
    const renderAngleBadge = () => {
        const displayedAngle = Math.round(((rotation % 360) + 360) % 360);
        return (
            <g
                transform={`translate(${cx}, ${cy}) rotate(${-rotation})`}
                style={{ pointerEvents: "none" }}
            >
                <g style={{ transform: handleScaleTransform }}>
                    <rect x={-26} y={-12} width={52} height={24} rx={12} fill="rgba(0,0,0,0.75)" />
                    <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={12}
                        fontFamily={theme.typography?.fontFamily}
                    >
                        {displayedAngle}°
                    </text>
                </g>
            </g>
        );
    };

    // Sécurité si pas de bbox
    if (width === undefined || height === undefined) return null;

    return (
        <g
            // On applique la translation ET la rotation sur le groupe parent
            // La rotation se fait autour du centre du rectangle (cx, cy)
            transform={`translate(${x || 0}, ${y || 0}) rotate(${rotation}, ${cx}, ${cy})`}
            style={{ opacity: dragged ? 0.7 : fillOpacity }}
        >
            {/* Pattern DEFS */}
            <defs>
                {(fillType === "HATCHING" || fillType === "HATCHING_LEFT") && (
                    <pattern id={patternIdRef.current} patternUnits="userSpaceOnUse" width={HATCHING_SPACING} height={HATCHING_SPACING}>
                        {fillType === "HATCHING" ? (
                            <path d={`M 0,${HATCHING_SPACING} L ${HATCHING_SPACING},0`} stroke={fillColor} strokeWidth={2} />
                        ) : (
                            <path d={`M 0,0 L ${HATCHING_SPACING},${HATCHING_SPACING}`} stroke={fillColor} strokeWidth={2} />
                        )}
                    </pattern>
                )}
            </defs>

            {/* Conteneur principal draggable */}
            <g {...interactionProps}>
                <rect
                    x={0} y={0}
                    width={width}
                    height={height}
                    fill={finalFill}
                    //fillOpacity={0.5}
                    style={{
                        cursor: selected && !transformLocked ? "move" : (hovered ? "pointer" : "default"),
                        transition: "fill 0.2s"
                    }}
                    {...((selected || fillType === "HATCHING" || fillType === "HATCHING_LEFT") && {
                        stroke: fillColor,
                        strokeWidth: 1,
                        vectorEffect: "non-scaling-stroke",
                    })}
                />
            </g>

            {/* Poignées (Uniquement si sélectionné et pas en cours de déplacement global) */}
            {selected && !dragged && !transformLocked && (
                <g>
                    {/* Resize — hidden when both dimensions are locked by the template */}
                    {!resizeLocked && (
                        <>
                            {renderResizeHandle("NW", 0, 0)}
                            {renderResizeHandle("NE", width, 0)}
                            {renderResizeHandle("SW", 0, height)}
                            {renderResizeHandle("SE", width, height)}
                        </>
                    )}

                    {/* Rotate — toujours disponible */}
                    {renderRotationHandle()}
                </g>
            )}

            {dragged && draggedPartType === "ROTATE" && renderAngleBadge()}
        </g>
    );
});