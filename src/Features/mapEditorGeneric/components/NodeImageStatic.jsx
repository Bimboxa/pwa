import { memo, useMemo } from "react";
import theme from "Styles/theme";

// Taille des poignées de redimensionnement (en pixels écran fixes)
const HANDLE_SIZE = 10; // Un peu plus grand pour faciliter le grab
const HALF_HANDLE = HANDLE_SIZE / 2;
const ROTATION_HANDLE_OFFSET = 30; // Distance de la poignée de rotation (en pixels locaux)

export default memo(function NodeImageStatic({
    imageAnnotation,
    hovered,
    selected,
    dragged,
    grayScale = false,
    containerK = 1,

}) {
    const { bbox, image, id, opacity } = imageAnnotation;
    const { x, y, width, height } = bbox ?? {};

    // Fallbacks
    const displayWidth = width || 100;
    const displayHeight = height || 100;
    const src = image?.imageUrlClient;

    // --- 1. CALCUL DE L'ÉCHELLE INVERSE (Même logique que NodePolyline) ---
    // Cela permet de contrer le zoom de la caméra (var(--map-zoom)) et l'échelle du conteneur (containerK)
    const handleScaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);






    if (!src) return null;

    // Props pour le drag global (déplacement)
    const interactionProps = {
        "data-node-id": id,
        "data-node-entity-id": imageAnnotation.entityId,
        "data-node-listing-id": imageAnnotation.listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "IMAGE",
        "data-interaction": "draggable"
    };

    // Style de bordure
    const borderStyle = {
        fill: "none",
        strokeWidth: 2, // On peut mettre une valeur fixe si on utilise vector-effect
        vectorEffect: "non-scaling-stroke", // Garde le trait fin même au zoom
        pointerEvents: "none"
    };

    const cx = displayWidth / 2;
    const cy = displayHeight / 2;
    const rotation = imageAnnotation.rotation || 0;

    // --- 2. RENDU DES POIGNÉES AVEC SCALE FIXE ---
    const renderHandle = (type, hx, hy) => (
        <g
            transform={`translate(${hx}, ${hy})`} // 1. On se place au coin
            style={{ pointerEvents: "auto" }}
        >
            {/* 2. On applique l'échelle inverse pour que le contenu reste fixe à l'écran */}
            <g style={{ transform: handleScaleTransform }}>
                <rect
                    x={-HALF_HANDLE} // Centré
                    y={-HALF_HANDLE}
                    width={HANDLE_SIZE}
                    height={HANDLE_SIZE}
                    fill="#fff"
                    stroke={theme.palette.secondary.main}
                    strokeWidth={1.5}
                    // Attributs pour l'interaction
                    data-interaction="resize-annotation"
                    data-handle-type={type}
                    data-node-id={id}
                    data-node-type="ANNOTATION"
                    style={{ cursor: `${type.toLowerCase()}-resize` }}
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




    // --- RENDU ---
    return (
        <g
            transform={`translate(${x || 0}, ${y || 0}) rotate(${rotation}, ${cx}, ${cy})`}
            style={{ opacity: dragged ? 0.7 : opacity }}
        >


            {/* Conteneur principal draggable */}
            <g {...interactionProps}>
                <image
                    href={src}
                    x={0} y={0}
                    width={displayWidth}
                    height={displayHeight}
                    preserveAspectRatio="none"
                    style={{
                        imageRendering: "optimizeSpeed",
                        filter: grayScale ? "grayscale(100%)" : "none",
                        cursor: selected ? "move" : (hovered ? "pointer" : "default")
                    }}
                />

                {/* Bordure Hover */}
                {hovered && !selected && !dragged && (
                    <rect
                        width={displayWidth} height={displayHeight}
                        {...borderStyle}
                        stroke={theme.palette.baseMap.hovered || "#2196f3"}
                    />
                )}

                {/* Bordure Sélection */}
                {selected && (
                    <rect
                        width={displayWidth} height={displayHeight}
                        {...borderStyle}
                        stroke={theme.palette.baseMap.selected || "#ff9800"}
                    />
                )}
            </g>

            {/* Poignées de redimensionnement */}
            {/* Elles sont rendues après l'image pour être au-dessus */}
            {selected && !dragged && (
                <g>
                    {renderHandle("NW", 0, 0)}
                    {renderHandle("NE", displayWidth, 0)}
                    {renderHandle("SW", 0, displayHeight)}
                    {renderHandle("SE", displayWidth, displayHeight)}
                    {renderRotationHandle()}
                </g>
            )}
        </g>
    );
});