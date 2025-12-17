// components/layers/TransientTopologyLayer.jsx
import React, { useMemo } from 'react';
import NodePolylineStatic from './NodePolylineStatic';

export default function TransientTopologyLayer({
    annotations,
    movingPointId,
    currentPos,
    // virtualInsertion: { annotationId, segmentIndex, cutIndex? } 
    // cutIndex (number) est présent si on split un segment d'un trou
    virtualInsertion,
    viewportScale,
    baseMapMeterByPx,
}) {

    const modifiedAnnotations = useMemo(() => {
        if (!currentPos) return [];

        // =========================================================
        // CAS 1 : INSERTION VIRTUELLE (Split Segment)
        // =========================================================
        if (virtualInsertion) {
            const targetAnn = annotations.find(a => a.id === virtualInsertion.annotationId);
            if (!targetAnn) return [];

            const virtualPoint = {
                id: movingPointId,
                x: currentPos.x,
                y: currentPos.y,
                type: 'square'
            };

            // A. Insertion dans un TROU (via cutIndex)
            // On vérifie si cutIndex est défini (attention, 0 est falsy, donc check type ou undefined)
            if (typeof virtualInsertion.cutIndex === 'number' && targetAnn.cuts) {
                const newCuts = targetAnn.cuts.map((cut, index) => {
                    // On cible le trou par son index
                    if (index === virtualInsertion.cutIndex) {
                        const newPoints = [...cut.points];
                        // Insertion après le point de début du segment
                        newPoints.splice(virtualInsertion.segmentIndex + 1, 0, virtualPoint);
                        return { ...cut, points: newPoints };
                    }
                    return cut;
                });

                return [{ ...targetAnn, cuts: newCuts }];
            }

            // B. Insertion dans le CONTOUR PRINCIPAL (Défaut)
            else {
                const newPoints = [...targetAnn.points];
                newPoints.splice(virtualInsertion.segmentIndex + 1, 0, virtualPoint);
                return [{ ...targetAnn, points: newPoints }];
            }
        }

        // =========================================================
        // CAS 2 : DÉPLACEMENT STANDARD (Point existant)
        // =========================================================
        if (!movingPointId) return [];

        // On cherche l'annotation qui contient ce point (Main ou Cut)
        const affected = annotations.filter(ann => {
            const inMain = ann.points?.some(pt => pt.id === movingPointId);
            if (inMain) return true;

            // Vérification dans les cuts
            if (ann.cuts) {
                return ann.cuts.some(cut => cut.points?.some(pt => pt.id === movingPointId));
            }
            return false;
        });

        return affected.map(ann => {
            const _ann = { ...ann };

            // A. Est-ce dans le main ?
            if (_ann.points?.some(pt => pt.id === movingPointId)) {
                _ann.points = _ann.points.map(pt =>
                    pt.id === movingPointId
                        ? { ...pt, x: currentPos.x, y: currentPos.y }
                        : pt
                );
            }

            // B. Est-ce dans un cut ?
            if (_ann.cuts) {
                _ann.cuts = _ann.cuts.map(cut => {
                    // Si le cut contient le point, on met à jour ses points
                    if (cut.points?.some(pt => pt.id === movingPointId)) {
                        return {
                            ...cut,
                            points: cut.points.map(pt =>
                                pt.id === movingPointId
                                    ? { ...pt, x: currentPos.x, y: currentPos.y }
                                    : pt
                            )
                        };
                    }
                    return cut;
                });
            }

            return _ann;
        });

    }, [annotations, movingPointId, currentPos, virtualInsertion]);

    if (modifiedAnnotations.length === 0) return null;

    return (
        <g className="transient-layer">
            {modifiedAnnotations.map(ann => (
                <NodePolylineStatic
                    key={ann.id}
                    annotation={ann}
                    // On passe le style visuel "en cours d'édition"
                    annotationOverride={{
                        strokeColor: "#2196f3",
                        strokeWidth: ann.strokeWidth,
                        strokeOpacity: 0.5,
                        // Force selected=true pour voir le remplissage des trous (opacity 0.2)
                        // défini dans votre NodePolylineStatic
                        selected: true
                    }}
                    baseMapMeterByPx={baseMapMeterByPx}
                    selected={true}
                    isTransient={true}
                />
            ))}

            {/* Le Point sous la souris */}
            <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r={6 / viewportScale}
                fill="transparent"
                stroke="#2196f3"
                strokeWidth={2 / viewportScale}
                strokeOpacity={0.5}
                style={{ cursor: 'crosshair', pointerEvents: 'none' }}
            />
        </g>
    );
}