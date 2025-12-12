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

        if (_annotation.type === "MARKER") {
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
                cursor: "grabbing"
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