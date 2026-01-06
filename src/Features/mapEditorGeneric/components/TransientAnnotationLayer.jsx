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
            const currentWidth = _annotation.image?.imageSize?.width * (_annotation.imageScale ?? 1) || 100;
            const currentHeight = _annotation.image?.imageSize?.height * (_annotation.imageScale ?? 1) || 100;
            const currentX = _annotation.imagePose.x || 0;
            const currentY = _annotation.imagePose.y || 0;

            // 1. Redimensionnement
            if (partType && partType.startsWith("RESIZE_")) {
                const handle = partType.replace("RESIZE_", "");
                let newX = currentX;
                let newY = currentY;
                let newW = currentWidth;
                let newH = currentHeight;

                // Logique simple de redimensionnement
                // Pour NW (Nord-Ouest), on bouge X,Y et on change W,H (inverse du delta)
                // Pour SE (Sud-Est), on change juste W,H (additif)

                if (handle.includes("E")) newW += deltaPos.x;
                if (handle.includes("W")) { newW -= deltaPos.x; newX += deltaPos.x; }
                if (handle.includes("S")) newH += deltaPos.y;
                if (handle.includes("N")) { newH -= deltaPos.y; newY += deltaPos.y; }

                // Sécurité taille min
                if (newW < 10) newW = 10;
                if (newH < 10) newH = 10;

                // Mise à jour de l'objet temporaire
                _annotation.imagePose = { x: newX, y: newY };
                // On clone la structure image pour ne pas muter la ref originale
                _annotation.imageScale = _annotation.imageScale * (newW / currentWidth);
            }
            // 2. Déplacement standard (Move)
            else {
                _annotation.imagePose = { x: currentX + deltaPos.x, y: currentY + deltaPos.y };
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