import React, { useMemo } from "react";
import { darken } from "@mui/material/styles";

export default function NodePointStatic({
    annotation,
    annotationOverride, // Pour le drag (transient)
    selected,
    hovered,
    dragged,
    baseMapMeterByPx, // Indispensable pour la conversion CM -> PX
    containerK = 1,   // Échelle actuelle du conteneur (Zoom)
}) {
    // 1. Fusion pour l'affichage temporaire (Drag)
    // annotationOverride contient les nouvelles coords lors du drag
    const mergedAnnotation = { ...annotation, ...annotationOverride };

    const {
        id,
        listingId,
        fillColor = "#2196f3", // Bleu par défaut
        variant = "CIRCLE",    // "CIRCLE" | "SQUARE"
        size = 20,             // Taille par défaut
        sizeUnit = "PX"        // "PX" | "CM"
    } = mergedAnnotation;

    // 2. Gestion Robuste de la Position
    // Le Drag met souvent x/y à la racine, alors que le modèle DB a souvent point.x/point.y
    const currentX = mergedAnnotation.x ?? mergedAnnotation.point?.x ?? 0;
    const currentY = mergedAnnotation.y ?? mergedAnnotation.point?.y ?? 0;

    // 3. Calcul de la taille de base (Géométrie locale)
    const sizeInLocalUnits = useMemo(() => {
        // Cas CM : On veut une taille physique réelle sur le plan
        if (sizeUnit === "CM" && baseMapMeterByPx > 0) {
            const sizeInMeters = size / 100;
            return sizeInMeters / baseMapMeterByPx;
        }
        // Cas PX : On retourne la taille brute (ex: 20)
        // Elle sera interprétée visuellement grâce au scaleTransform
        return size;
    }, [size, sizeUnit, baseMapMeterByPx]);

    // 4. Transformation d'Échelle (Le cœur du fix taille)
    const scaleTransform = useMemo(() => {
        // Si unité physique (CM), le point doit grossir avec le zoom -> Pas de correction d'échelle (scale 1)
        if (sizeUnit === "CM") return "scale(1)";

        // Si unité écran (PX), on veut annuler le zoom pour garder une taille fixe
        // On utilise la logique FIXED_IN_CONTAINER_PARENT
        // Si le conteneur est zoomé x2 (k=2), on réduit le point x0.5 pour qu'il garde sa taille visuelle
        const k = containerK || 1;
        return `scale(${1 / k})`;
    }, [sizeUnit, containerK]);

    // 5. Gestion des Couleurs
    const displayFillColor = useMemo(() => {
        if (hovered || selected) {
            try { return darken(fillColor, 0.2); } catch { return fillColor; }
        }
        return fillColor;
    }, [fillColor, hovered, selected]);

    const strokeColor = selected ? "#ffffff" : "rgba(255,255,255,0.6)";
    // Si la taille est fixe (PX), un stroke de 2px est bien.
    // Si la taille est scalée (CM), le stroke va aussi scaler, donc on le garde fin en base (1 ou moins)
    const strokeWidth = (sizeUnit === "CM") ? (selected ? 2 / containerK : 1 / containerK) : (selected ? 2 : 1);

    // 6. Data Attributes pour l'InteractionLayer
    // Ces attributs sont cruciaux pour que le 'hit detection' de la souris fonctionne pour le Drag
    const dataProps = {
        "data-node-id": id,
        "data-node-entity-id": mergedAnnotation.entityId,
        "data-node-listing-id": listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "POINT",
        "data-interaction": "draggable"
    };

    // 7. Rayon / Demi-taille pour le dessin
    const halfSize = sizeInLocalUnits / 2;

    return (
        <g
            transform={`translate(${currentX}, ${currentY})`}
            style={{
                cursor: dragged ? "grabbing" : "pointer",
                opacity: dragged ? 0.7 : 1,
                transition: "opacity 0.1s",
                // Important : ne pas mettre de transition sur transform pour éviter le lag du drag
            }}
            {...dataProps}
        >
            {/* GROUPE DE SCALE : Gère la taille visuelle (Fixe ou Physique) */}
            <g style={{ transform: scaleTransform }}>

                {/* Zone de hit invisible plus large (pour attraper facilement les petits points) */}
                <circle
                    r={Math.max(halfSize, 10)}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={5}
                />

                {/* Forme Visuelle */}
                {variant === "SQUARE" ? (
                    <rect
                        x={-halfSize}
                        y={-halfSize}
                        width={sizeInLocalUnits}
                        height={sizeInLocalUnits}
                        fill={displayFillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        style={selected ? { filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" } : {}}
                    />
                ) : (
                    <circle
                        cx={0}
                        cy={0}
                        r={halfSize}
                        fill={displayFillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        style={selected ? { filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" } : {}}
                    />
                )}

                {/* Crosshair (Feedback visuel pendant le drag) */}
                {dragged && (
                    <g style={{ pointerEvents: "none", opacity: 0.8 }}>
                        <line x1={-halfSize * 1.5} y1={0} x2={halfSize * 1.5} y2={0} stroke="black" strokeWidth={1} />
                        <line x1={0} y1={-halfSize * 1.5} x2={0} y2={halfSize * 1.5} stroke="black" strokeWidth={1} />
                    </g>
                )}
            </g>
        </g>
    );
}