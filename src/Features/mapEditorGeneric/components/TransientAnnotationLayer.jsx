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

        if (_annotation.type === "IMAGE" || _annotation.type === "RECTANGLE") {
            const currentBBox = _annotation.bbox || { x: 0, y: 0, width: 100, height: 100 };
            const currentRotation = _annotation.rotation || 0;

            const cx = currentBBox.x + currentBBox.width / 2;
            const cy = currentBBox.y + currentBBox.height / 2;

            // --- CAS 1 : ROTATION (ROTATE) ---
            if (partType === "ROTATE") {
                // Pour calculer la rotation correctement avec deltaPos (qui est un vecteur de déplacement),
                // il nous faut savoir où était la poignée au départ.
                // La poignée est visuellement au-dessus du centre : { x: cx, y: bbox.y - 30 }

                // On simplifie : On calcule l'angle du vecteur delta par rapport au centre ? Non.
                // La méthode la plus fiable avec deltaPos est de projeter le mouvement de la souris.

                // Si InteractionLayer nous passait 'currentMousePos' ce serait trivial (atan2).
                // Avec 'deltaPos', on suppose que le mouvement horizontal de la souris fait tourner l'objet.
                // C'est une UX commune (Virtual Trackball ou Slider invisible).
                // Sensibilité : 1px de déplacement = 0.5 degré de rotation (ajustable)

                // OPTION A : Rotation basée sur le mouvement X/Y (Style "Potentiomètre")
                // C'est souvent plus fluide que de suivre la souris exactement si on n'a pas les coords absolues.
                const sensitivity = 0.5;
                let angleDelta = (deltaPos.x + deltaPos.y) * sensitivity;

                // OPTION B (MIEUX) : Si deltaPos est le déplacement de la POIGNÉE.
                // La poignée est initialement à (0, -H/2 - 30) par rapport au centre.
                // C'est complexe sans connaître la position absolue de la souris.

                // => On va utiliser une approximation vectorielle simple :
                // On considère que la poignée est en haut. Un mouvement vers la droite (dx > 0) tourne à droite (+deg).
                // Un mouvement vers le bas (dy > 0) tourne aussi à droite si on est à droite... c'est compliqué.

                // RECOMMANDATION : Utilisez l'approche "Centre + Curseur" dans InteractionLayer pour passer l'angle exact.
                // MAIS si on doit faire avec ce qu'on a ici :

                _annotation.rotation = (currentRotation + deltaPos.x) % 360;
                // Ici on fait simple : glisser vers la droite tourne l'objet.
            }

            // --- CAS 2 : REDIMENSIONNEMENT (RESIZE) ---
            else if (partType && partType.startsWith("RESIZE_")) {
                const handle = partType.replace("RESIZE_", "");
                const aspectRatio = currentBBox.width / currentBBox.height;

                let nx = currentBBox.x;
                let ny = currentBBox.y;
                let nw = currentBBox.width;
                let nh = currentBBox.height;

                // A. SUD-EST (SE)
                if (handle === "SE") {
                    nw = currentBBox.width + deltaPos.x;
                    nh = nw / aspectRatio;
                }
                // B. SUD-OUEST (SW)
                else if (handle === "SW") {
                    nw = currentBBox.width - deltaPos.x;
                    nh = nw / aspectRatio;
                    nx = currentBBox.x + (currentBBox.width - nw);
                }
                // C. NORD-EST (NE)
                else if (handle === "NE") {
                    nw = currentBBox.width + deltaPos.x;
                    nh = nw / aspectRatio;
                    ny = currentBBox.y + (currentBBox.height - nh);
                }
                // D. NORD-OUEST (NW)
                else if (handle === "NW") {
                    nw = currentBBox.width - deltaPos.x;
                    nh = nw / aspectRatio;
                    nx = currentBBox.x + (currentBBox.width - nw);
                    ny = currentBBox.y + (currentBBox.height - nh);
                }

                // SÉCURITÉ
                if (nw < 20) {
                    nw = 20;
                    nh = nw / aspectRatio;
                    if (handle.includes("W")) nx = currentBBox.x + (currentBBox.width - 20);
                    if (handle.includes("N")) ny = currentBBox.y + (currentBBox.height - (20 / aspectRatio));
                }

                _annotation.bbox = { x: nx, y: ny, width: nw, height: nh };
            }

            // --- CAS 3 : DÉPLACEMENT (MOVE) ---
            else {
                _annotation.bbox = {
                    ...currentBBox,
                    x: currentBBox.x + deltaPos.x,
                    y: currentBBox.y + deltaPos.y
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


    // Curseur dynamique selon l'action
    let cursorStyle = "grabbing";
    if (partType === "ROTATE") cursorStyle = "grabbing"; // ou un icone de rotation
    else if (partType?.startsWith("RESIZE")) cursorStyle = "crosshair";

    return (
        <g
            className="transient-annotation-layer"
            style={{
                //pointerEvents: 'none',
                //cursor: "grabbing",
                cursor: cursorStyle
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