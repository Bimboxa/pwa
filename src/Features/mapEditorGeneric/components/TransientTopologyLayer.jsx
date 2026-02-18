import React, { useMemo } from 'react';

import NodePolylineStatic from './NodePolylineStatic';
import NodeStripStatic from './NodeStripStatic';

export default function TransientTopologyLayer({
    annotations,
    movingPointId,
    originalPointIdForDuplication, // Présent si mode "Duplication"
    selectedAnnotationId,          // Présent si mode "Duplication" (ID de l'élue)
    currentPos,
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
            // (Code inchangé pour l'insertion...)
            const targetAnn = annotations.find(a => a.id === virtualInsertion.annotationId);
            if (!targetAnn) return [];

            const virtualPoint = {
                id: movingPointId,
                x: currentPos.x,
                y: currentPos.y,
                type: 'square'
            };

            if (typeof virtualInsertion.cutIndex === 'number' && targetAnn.cuts) {
                const newCuts = targetAnn.cuts.map((cut, index) => {
                    if (index === virtualInsertion.cutIndex) {
                        const newPoints = [...cut.points];
                        newPoints.splice(virtualInsertion.segmentIndex + 1, 0, virtualPoint);
                        return { ...cut, points: newPoints };
                    }
                    return cut;
                });
                return [{ ...targetAnn, cuts: newCuts }];
            } else {
                const newPoints = [...targetAnn.points];
                newPoints.splice(virtualInsertion.segmentIndex + 1, 0, virtualPoint);
                return [{ ...targetAnn, points: newPoints }];
            }
        }

        // =========================================================
        // CAS 2 : DUPLICATION (Mode Annotation Sélectionnée)
        // =========================================================
        if (originalPointIdForDuplication && selectedAnnotationId) {

            // 1. On ne cherche QUE l'annotation sélectionnée
            // Les autres annotations connectées ne sont pas touchées (elles restent dans StaticMapContent)
            const targetAnn = annotations.find(a => a.id === selectedAnnotationId);

            if (!targetAnn) return [];

            // On clone l'objet pour modifier ses points sans muter
            const _ann = { ...targetAnn };

            // A. Mise à jour du contour principal
            if (_ann.points) {
                _ann.points = _ann.points.map(pt =>
                    pt.id === originalPointIdForDuplication
                        ? { ...pt, x: currentPos.x, y: currentPos.y, id: movingPointId } // Nouvel ID temporaire + Nouvelle Pos
                        : pt
                );
            }

            // B. Mise à jour des trous (Cuts)
            if (_ann.cuts) {
                _ann.cuts = _ann.cuts.map(cut => {
                    // Si le cut contient le point original, on le remplace par le clone déplacé
                    if (cut.points?.some(p => p.id === originalPointIdForDuplication)) {
                        const newCutPoints = cut.points.map(pt =>
                            pt.id === originalPointIdForDuplication
                                ? { ...pt, x: currentPos.x, y: currentPos.y, id: movingPointId }
                                : pt
                        );
                        return { ...cut, points: newCutPoints };
                    }
                    return cut;
                });
            }

            return [_ann];
        }

        // =========================================================
        // CAS 3 : DÉPLACEMENT STANDARD (Mode Topologique / Point Partagé)
        // =========================================================
        if (!movingPointId) return [];

        // On cherche TOUTES les annotations qui contiennent ce point
        const affected = annotations.filter(ann => {
            const inMain = ann.points?.some(pt => pt.id === movingPointId);
            if (inMain) return true;
            if (ann.cuts) {
                return ann.cuts.some(cut => cut.points?.some(pt => pt.id === movingPointId));
            }
            return false;
        });

        return affected.map(ann => {
            const _ann = { ...ann };

            // A. Main Points
            if (_ann.points?.some(pt => pt.id === movingPointId)) {
                _ann.points = _ann.points.map(pt =>
                    pt.id === movingPointId
                        ? { ...pt, x: currentPos.x, y: currentPos.y }
                        : pt
                );
            }

            // B. Cuts
            if (_ann.cuts) {
                _ann.cuts = _ann.cuts.map(cut => {
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

    }, [annotations, movingPointId, currentPos, virtualInsertion, originalPointIdForDuplication, selectedAnnotationId]);

    if (modifiedAnnotations.length === 0) return null;

    return (
        <g className="transient-layer">
            {modifiedAnnotations.map(ann => {
                return <React.Fragment key={ann.id}>
                    {["POLYGON", "POLYLINE"].includes(ann.type) && <NodePolylineStatic
                        annotation={ann}
                        annotationOverride={{
                            strokeColor: "#2196f3",
                            //strokeWidth: ann.strokeWidth,
                            strokeOpacity: 0.5,
                            selected: true
                        }}
                        baseMapMeterByPx={baseMapMeterByPx}
                        selected={true}
                        isTransient={true}
                    />}

                    {ann.type === "STRIP" && <NodeStripStatic
                        annotation={ann}
                        annotationOverride={{
                            strokeColor: "#2196f3",
                            //strokeWidth: ann.strokeWidth,
                            strokeOpacity: 0.5,
                            selected: true
                        }}
                        baseMapMeterByPx={baseMapMeterByPx}
                        selected={true}
                        isTransient={true}
                    />}
                </React.Fragment>
            })}

            {/* Le Point sous la souris (Feedback visuel) */}
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