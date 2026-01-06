import { memo } from "react";
import theme from "Styles/theme";

// Taille des poignées de redimensionnement
const HANDLE_SIZE = 8;

export default memo(function NodeImageStatic({
    imageAnnotation,
    hovered,
    selected,
    dragged,
    opacity = 1,
    grayScale = false,
    // On récupère le facteur d'échelle pour garder les poignées de taille constante
    containerK = 1,
}) {
    const { imagePose, image, id
    } = imageAnnotation;
    const { x, y } = imagePose ?? {};

    console.log("imageAnnotation", imageAnnotation);

    // Fallbacks
    const displayWidth = image?.imageSize?.width * (imageAnnotation.imageScale ?? 1) || 100;
    const displayHeight = image?.imageSize?.height * (imageAnnotation.imageScale ?? 1) || 100;
    const src = image?.imageUrlClient;

    if (!src) return null;

    // Props pour le drag global (déplacement)
    const interactionProps = {
        "data-node-id": id,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "IMAGE",
        "data-interaction": "draggable"
    };

    // Style de bordure
    const borderStyle = {
        fill: "none",
        strokeWidth: 2 / containerK, // Trait constant
        vectorEffect: "non-scaling-stroke",
        pointerEvents: "none"
    };

    // Helper pour générer une poignée
    const renderHandle = (type, hx, hy) => (
        <rect
            x={hx - (HANDLE_SIZE / 2) / containerK}
            y={hy - (HANDLE_SIZE / 2) / containerK}
            width={HANDLE_SIZE / containerK}
            height={HANDLE_SIZE / containerK}
            fill="#fff"
            stroke={theme.palette.baseMap.selected}
            strokeWidth={1 / containerK}
            // Ces attributs seront lus par InteractionLayer
            data-interaction="resize-annotation"
            data-handle-type={type}
            data-node-id={id}
            data-node-type="ANNOTATION"
            style={{ cursor: `${type.toLowerCase()}-resize`, pointerEvents: "auto" }}
        />
    );

    return (
        <g
            transform={`translate(${x || 0}, ${y || 0})`}
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

            {/* Poignées de redimensionnement (Hors du groupe draggable pour gérer l'event séparément) */}
            {selected && !dragged && (
                <g>
                    {renderHandle("NW", 0, 0)}
                    {renderHandle("NE", displayWidth, 0)}
                    {renderHandle("SW", 0, displayHeight)}
                    {renderHandle("SE", displayWidth, displayHeight)}
                </g>
            )}
        </g>
    );
});