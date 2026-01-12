// components/layers/TransientTopologyLayer.jsx
import React, { useMemo } from 'react';

import NodeAnnotationStatic from './NodeAnnotationStatic';

export default function TransientAnnotationLayer({
    annotation,
    deltaPos,
    partType,
    baseMapMeterByPx,
    basePose,
}) {

    const modifiedAnnotation = useMemo(() => {
        if (!deltaPos) return annotation;

        const _annotation = { ...annotation };

        if (_annotation.type === "IMAGE") {
            const currentBBox = _annotation.bbox || { x: 0, y: 0, width: 100, height: 100 };

            const currentX = currentBBox.x;
            const currentY = currentBBox.y;
            const currentW = currentBBox.width;
            const currentH = currentBBox.height;

            // 1. Calcul du Ratio (Largeur / Hauteur)
            const aspectRatio = currentW / currentH;

            // 1. Redimensionnement (via les poignées)
            if (partType && partType.startsWith("RESIZE_")) {
                const handle = partType.replace("RESIZE_", "");

                let newX = currentX;
                let newY = currentY;
                let newW = currentW;
                let newH = currentH;

                // On utilise l'axe dominant pour piloter le resize pour une meilleure UX
                // Si l'image est large, on se base sur le mouvement X. Si elle est haute, sur Y.
                // Ici, on simplifie en laissant X piloter la largeur, sauf pour N/S.

                // --- LOGIQUE HOMOTHÉTIQUE PAR COIN ---

                // A. SUD-EST (SE) -> Coin fixe : Nord-Ouest (Haut-Gauche)
                // X et Y ne bougent pas.
                if (handle === "SE") {
                    newW = currentW + deltaPos.x;
                    newH = newW / aspectRatio;
                }

                // B. SUD-OUEST (SW) -> Coin fixe : Nord-Est (Haut-Droit)
                // Y ne bouge pas (Haut fixe). X bouge pour compenser la largeur.
                else if (handle === "SW") {
                    newW = currentW - deltaPos.x; // Moins car on va vers la gauche
                    newH = newW / aspectRatio;
                    newX = currentX + (currentW - newW); // On décale X de la différence
                }

                // C. NORD-EST (NE) -> Coin fixe : Sud-Ouest (Bas-Gauche)
                // X ne bouge pas (Gauche fixe). Y bouge pour compenser la hauteur.
                else if (handle === "NE") {
                    newW = currentW + deltaPos.x;
                    newH = newW / aspectRatio;
                    newY = currentY + (currentH - newH); // On décale Y de la différence
                }

                // D. NORD-OUEST (NW) -> Coin fixe : Sud-Est (Bas-Droit)
                // X et Y bougent tous les deux.
                else if (handle === "NW") {
                    newW = currentW - deltaPos.x;
                    newH = newW / aspectRatio;
                    newX = currentX + (currentW - newW);
                    newY = currentY + (currentH - newH);
                }

                // E. Bords (N, S, E, W) - Optionnel
                // Pour garder le ratio sur un bord, on doit zoomer depuis le centre opposé
                else if (handle === "E") {
                    newW = currentW + deltaPos.x;
                    newH = newW / aspectRatio;
                    newY = currentY + (currentH - newH) / 2; // Centre Y
                }
                // ... (similaire pour les autres bords si nécessaire)


                // --- SÉCURITÉ & LIMITES ---
                // On empêche l'inversion (largeur négative)
                if (newW < 20) {
                    newW = 20;
                    newH = newW / aspectRatio;

                    // Si on bloque la taille, il faut aussi bloquer la position pour éviter que l'objet glisse
                    // On recalcule la position idéale basée sur la taille minimum
                    if (handle.includes("W")) newX = currentX + (currentW - 20);
                    if (handle.includes("N")) newY = currentY + (currentH - (20 / aspectRatio));
                }

                // Mise à jour Bbox
                _annotation.bbox = {
                    x: newX,
                    y: newY,
                    width: newW,
                    height: newH
                };
            }

            // 2. Déplacement standard (Move)
            else {
                _annotation.bbox = {
                    ...currentBBox,
                    x: currentX + deltaPos.x,
                    y: currentY + deltaPos.y
                };
            }
        }

        if (_annotation.type === "MARKER" || _annotation.type === "POINT") {
            _annotation.point = {
                x: _annotation.point.x + deltaPos.x,
                y: _annotation.point.y + deltaPos.y
            }
        }

        if (_annotation.type === "LABEL") {
            // 1. Si on drag la CIBLE (le rond)
            if (partType === 'TARGET') {
                _annotation.targetPoint = {
                    x: _annotation.targetPoint.x + deltaPos.x,
                    y: _annotation.targetPoint.y + deltaPos.y
                };
                // Le labelPoint ne bouge pas, la ligne va s'étirer visuellement
            }

            // 2. Si on drag la BOITE (le texte)
            else if (partType === 'LABEL_BOX') {
                _annotation.labelPoint = {
                    x: _annotation.labelPoint.x + deltaPos.x,
                    y: _annotation.labelPoint.y + deltaPos.y
                };
                // Le targetPoint ne bouge pas
            }

            // 3. Fallback (si on drag une partie non identifiée ou comportement par défaut)
            // On déplace tout l'objet
            else {
                _annotation.targetPoint = {
                    x: _annotation.targetPoint.x + deltaPos.x,
                    y: _annotation.targetPoint.y + deltaPos.y
                };
                _annotation.labelPoint = {
                    x: _annotation.labelPoint.x + deltaPos.x,
                    y: _annotation.labelPoint.y + deltaPos.y
                };
            }
        }

        if (_annotation.type === "POLYLINE" || _annotation.type === "POLYGON") {
            _annotation.points = _annotation.points.map(pt => {
                pt.x += deltaPos.x;
                pt.y += deltaPos.y;
                return pt;
            });
        }

        return _annotation;

    }, [annotation?.id, deltaPos, partType]);

    if (!annotation) return null;

    return (
        <g
            className="transient-annotation-layer"
            style={{
                //pointerEvents: 'none',
                //cursor: "grabbing",
                cursor: partType?.startsWith("RESIZE") ? "crosshair" : "grabbing"
            }}
        >
            <NodeAnnotationStatic
                annotation={modifiedAnnotation}
                baseMapMeterByPx={baseMapMeterByPx}
                dragged={true}
                sizeVariant="FIXED_IN_SCREEN"
                containerK={basePose.k}
            />
        </g>
    );
}