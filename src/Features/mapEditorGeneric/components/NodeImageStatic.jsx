// components/mapEditorGeneric/components/NodeImageAnnotation.jsx
import { memo, useMemo } from "react";
import theme from "Styles/theme";

export default memo(function NodeImageStatic({
    imageAnnotation,
    hovered,
    selected,
    dragged,
    opacity = 1,
    grayScale = false,
}) {
    // 1. Extraction des données
    const { x, y, image, id } = imageAnnotation;

    // Fallbacks pour la taille si width/height ne sont pas encore définis à la racine
    const displayWidth = image?.imageSize?.width || 100;
    const displayHeight = image?.imageSize?.height || 100;
    const src = image?.imageUrlClient;

    if (!src) return null;

    // 2. Props pour l'interaction (Drag)
    const interactionProps = {
        "data-node-id": id,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "IMAGE",
        "data-interaction": "draggable" // Déclenche le drag dans InteractionLayer
    };

    // 3. Styles de sélection (cohérent avec NodeSvgImage)
    // On garde une épaisseur visuelle constante indépendamment du zoom (si possible)
    // Ici simplifié à 2px pour l'exemple
    const borderStyle = {
        fill: "none",
        strokeWidth: 2,
        vectorEffect: "non-scaling-stroke", // Garde le trait fin même si on zoom
        pointerEvents: "none"
    };

    return (
        <g
            transform={`translate(${x || 0}, ${y || 0})`}
            style={{ opacity: dragged ? 0.7 : opacity }}
            {...interactionProps}
        >
            {/* L'image elle-même */}
            <image
                href={src}
                x={0}
                y={0}
                width={displayWidth}
                height={displayHeight}
                preserveAspectRatio="none"
                style={{
                    imageRendering: "optimizeSpeed",
                    filter: grayScale ? "grayscale(100%)" : "none",
                    cursor: selected ? "move" : (hovered ? "pointer" : "default")
                }}
            />

            {/* Bordure au survol */}
            {hovered && !selected && !dragged && (
                <rect
                    x={0}
                    y={0}
                    width={displayWidth}
                    height={displayHeight}
                    {...borderStyle}
                    stroke={theme.palette.baseMap.hovered || "#2196f3"}
                />
            )}

            {/* Bordure à la sélection */}
            {selected && (
                <rect
                    x={0}
                    y={0}
                    width={displayWidth}
                    height={displayHeight}
                    {...borderStyle}
                    stroke={theme.palette.baseMap.selected || "#ff9800"}
                />
            )}
        </g>
    );
});