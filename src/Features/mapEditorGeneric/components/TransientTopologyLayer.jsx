// components/layers/TransientTopologyLayer.jsx
import React, { useMemo } from 'react';
import NodePolylineStatic from './NodePolylineStatic';

export default function TransientTopologyLayer({
    annotations,
    movingPointId,
    currentPos,
    virtualInsertion, // <--- NOUVELLE PROP: { annotationId, segmentIndex }
    viewportScale,
    baseMapMeterByPx
}) {

    const modifiedAnnotations = useMemo(() => {
        if (!currentPos) return [];

        // CAS 1 : INSERTION VIRTUELLE (Split Segment)
        if (virtualInsertion) {
            const targetAnn = annotations.find(a => a.id === virtualInsertion.annotationId);
            if (!targetAnn) return [];

            // On crée une copie de l'annotation
            const newPoints = [...targetAnn.points];

            // On insère le point virtuel à la position de la souris
            // segmentIndex est l'index du point de DÉBUT du segment. On insère après.
            const virtualPoint = {
                id: movingPointId,
                x: currentPos.x,
                y: currentPos.y,
                type: 'square' // ou circle selon votre logique
            };

            newPoints.splice(virtualInsertion.segmentIndex + 1, 0, virtualPoint);

            return [{
                ...targetAnn,
                points: newPoints
            }];
        }

        // CAS 2 : DÉPLACEMENT STANDARD (Point existant)
        if (!movingPointId) return [];

        const affected = annotations.filter(ann =>
            ann.points?.some(pt => pt.id === movingPointId)
        );

        return affected.map(ann => ({
            ...ann,
            points: ann.points.map(pt =>
                pt.id === movingPointId
                    ? { ...pt, x: currentPos.x, y: currentPos.y }
                    : pt
            )
        }));

    }, [annotations, movingPointId, currentPos, virtualInsertion]);

    if (modifiedAnnotations.length === 0) return null;

    return (
        <g className="transient-layer" style={{ pointerEvents: 'none' }}>
            {modifiedAnnotations.map(ann => (
                <NodePolylineStatic
                    key={ann.id}
                    annotation={ann}
                    // Style visuel pendant le drag (ex: trait bleu)
                    annotationOverride={{ strokeColor: "#2196f3", strokeWidth: ann.strokeWidth }}
                    baseMapMeterByPx={baseMapMeterByPx}
                />
            ))}

            {/* Le Point sous la souris */}
            <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r={6 / viewportScale}
                fill="white"
                stroke="#2196f3"
                strokeWidth={2 / viewportScale}
            />
        </g>
    );
}