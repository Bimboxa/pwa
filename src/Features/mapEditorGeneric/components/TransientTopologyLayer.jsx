import React, { useMemo } from 'react';

import { lighten } from '@mui/material/styles';

import NodePolylineStatic from './NodePolylineStatic';
import NodeStripStatic from './NodeStripStatic';
import NodeCoteStatic from './NodeCoteStatic';
import NodeOpeningStatic from './NodeOpeningStatic';

import computeOpeningEndpointsFromHost, { buildHostCurve } from 'Features/mapEditor/utils/computeOpeningEndpointsFromHost';
import computeOpeningSegmentPlacement from 'Features/mapEditor/utils/computeOpeningSegmentPlacement';

export default function TransientTopologyLayer({
    annotations,
    movingPointId,
    originalPointIdForDuplication, // Présent si mode "Duplication"
    selectedAnnotationId,          // Présent si mode "Duplication" (ID de l'élue)
    currentPos,
    virtualInsertion,
    viewportScale,
    containerK,
    baseMapMeterByPx,
    openingRels, // relAnnotationOpenings rows — live reflow of glued openings
}) {

    const modifiedAnnotations = useMemo(() => {
        if (!currentPos) return [];

        // =========================================================
        // CAS 1 : INSERTION VIRTUELLE (Split Segment)
        // =========================================================
        if (virtualInsertion) {
            const targetAnn = annotations.find(a => a.id === virtualInsertion.annotationId);
            if (!targetAnn) return [];

            // Detect whether the insertion targets the guideLine (vs the main
            // contour / a cut). The snap's segment endpoint ids unambiguously
            // identify which ring this segment belongs to.
            const sId = virtualInsertion.segmentStartId;
            const eId = virtualInsertion.segmentEndId;
            const guideLines = Array.isArray(targetAnn.guideLines) ? targetAnn.guideLines : [];
            const guideIndex = guideLines.findIndex(
                (gl) =>
                    (gl?.points?.length ?? 0) >= 2 &&
                    gl.points.some((g) => (g.pointId || g.id) === sId) &&
                    gl.points.some((g) => (g.pointId || g.id) === eId)
            );

            if (guideIndex >= 0) {
                // Insert into that guideLine. Refs use `pointId` as the id
                // field; mirror `id` so the renderer (which reads `id`) finds
                // the virtual point's x/y unchanged.
                const guide = guideLines[guideIndex].points;
                let insertAt = -1;
                for (let i = 0; i < guide.length - 1; i++) {
                    const aId = guide[i].pointId || guide[i].id;
                    const bId = guide[i + 1].pointId || guide[i + 1].id;
                    if (
                        (aId === sId && bId === eId) ||
                        (aId === eId && bId === sId)
                    ) {
                        insertAt = i + 1;
                        break;
                    }
                }
                if (insertAt < 0) return [];
                const nextG = guide[insertAt] || guide[insertAt - 1];
                const virtualGuidePoint = {
                    pointId: movingPointId,
                    id: movingPointId,
                    x: currentPos.x,
                    y: currentPos.y,
                    type: nextG?.type === 'circle' ? 'circle' : 'square',
                };
                const newGuide = [...guide];
                newGuide.splice(insertAt, 0, virtualGuidePoint);
                const newGuideLines = guideLines.map((gl, i) =>
                    i === guideIndex ? { ...gl, points: newGuide } : gl
                );
                return [{ ...targetAnn, guideLines: newGuideLines }];
            }

            // 1. Récupérer les points du contour concerné (Main ou Cut)
            const pointsRef = (typeof virtualInsertion.cutIndex === 'number')
                ? targetAnn.cuts[virtualInsertion.cutIndex].points
                : targetAnn.points;

            // 2. Déterminer le type du point à insérer
            // On regarde le point qui termine le segment cliqué
            const nextPoint = pointsRef[(virtualInsertion.segmentIndex + 1) % pointsRef.length];

            const virtualPoint = {
                id: movingPointId,
                x: currentPos.x,
                y: currentPos.y,
                // Si le point suivant est un cercle, on insère un cercle pour préserver la courbure
                type: nextPoint?.type === 'circle' ? 'circle' : 'square'
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
        // (contour, trous, ou points intérieurs Steiner)
        const affected = annotations.filter(ann => {
            const inMain = ann.points?.some(pt => pt.id === movingPointId);
            if (inMain) return true;
            if (ann.cuts?.some(cut => cut.points?.some(pt => pt.id === movingPointId))) return true;
            if (ann.innerPoints?.some(pt => pt.id === movingPointId)) return true;
            if (ann.guideLines?.some(gl => gl?.points?.some(g => g.pointId === movingPointId || g.id === movingPointId))) return true;
            if (ann.isoHeightLines?.some(l => l?.points?.some(g => g.pointId === movingPointId || g.id === movingPointId))) return true;
            return false;
        });

        // Openings glued on a host segment whose endpoint is being dragged:
        // recompute their 2 endpoints per frame from the moved host geometry
        // (fixed distance from the reference vertex, fixed length). Openings
        // own their point rows, so they are NOT in `affected` — the anchor
        // link comes from the relAnnotationOpenings rows.
        const openingReflows = [];
        if (Array.isArray(openingRels) && baseMapMeterByPx > 0) {
            for (const rel of openingRels) {
                const anchoredOnMovingPoint =
                    rel.hostSegmentStartPointId === movingPointId ||
                    rel.hostSegmentEndPointId === movingPointId ||
                    rel.hostArcControlPointId === movingPointId;

                const hostAnn = annotations.find(
                    (a) => a.id === rel.hostAnnotationId
                );
                const hostContainsMovingPoint = hostAnn?.points?.some(
                    (p) => p.id === movingPointId
                );
                // Reflow when the dragged vertex belongs to the host wall:
                // via the stored anchor when the anchor itself moves, else via
                // projection (stale anchor — a carve re-minted the ring ids).
                if (!anchoredOnMovingPoint && !hostContainsMovingPoint) continue;

                const openingAnn = annotations.find(
                    (a) => a.id === rel.openingAnnotationId
                );
                if (!openingAnn || openingAnn.points?.length !== 2) continue;

                const widthM = Number(openingAnn.width);
                if (!(widthM > 0)) continue;
                const openingLengthPx = widthM / baseMapMeterByPx;

                let endpoints = null;

                if (anchoredOnMovingPoint) {
                    const findPt = (id) => {
                        if (!id) return null;
                        if (id === movingPointId) return currentPos;
                        const inMain = hostAnn?.points?.find((p) => p.id === id);
                        return inMain ?? null;
                    };
                    const segStartPx = findPt(rel.hostSegmentStartPointId);
                    const segEndPx = findPt(rel.hostSegmentEndPointId);
                    const arcControlPx = rel.hostArcControlPointId
                        ? findPt(rel.hostArcControlPointId)
                        : null;
                    if (segStartPx && segEndPx) {
                        endpoints = computeOpeningEndpointsFromHost({
                            segStartPx,
                            segEndPx,
                            hostDistancePx:
                                (Number(rel.hostDistanceM) || 0) / baseMapMeterByPx,
                            openingLengthPx,
                            arcControlPx,
                        });
                    }
                }

                if (!endpoints) {
                    // Stale anchor (e.g. ids re-minted by a contour carve):
                    // mirror the commit reflow — project the opening center
                    // onto the moved host contour stripped of this rel's
                    // notch points, so the ghost tracks the real wall segment.
                    const notchSet = new Set(
                        rel.carve?.mode === "CONTOUR"
                            ? rel.carve.notchPointIds ?? []
                            : []
                    );
                    const movedHostPoints = (hostAnn?.points ?? [])
                        .filter((p) => !notchSet.has(p.id))
                        .map((p) =>
                            p.id === movingPointId
                                ? { ...p, x: currentPos.x, y: currentPos.y }
                                : p
                        );
                    if (movedHostPoints.length < 2) continue;
                    const center = {
                        x: (openingAnn.points[0].x + openingAnn.points[1].x) / 2,
                        y: (openingAnn.points[0].y + openingAnn.points[1].y) / 2,
                    };
                    const placement = computeOpeningSegmentPlacement({
                        cursorPx: center,
                        annotations: [
                            { ...hostAnn, points: movedHostPoints, isOpening: false },
                        ],
                        openingLengthPx,
                        hoverThresholdPx: Infinity,
                        vertexSnapPx: 0,
                        anchorEnd: "start",
                    });
                    if (!placement) continue;
                    // Keep the opening CENTER at its projection on the found
                    // segment (placement.hostDistancePx anchors the p1
                    // endpoint at the cursor — drawing-preview semantics).
                    const segCurve = buildHostCurve(
                        placement.segStart,
                        placement.segEnd,
                        placement.arcControl
                    );
                    endpoints = computeOpeningEndpointsFromHost({
                        segStartPx: placement.segStart,
                        segEndPx: placement.segEnd,
                        hostDistancePx: segCurve.project(center).s,
                        openingLengthPx,
                        arcControlPx: placement.arcControl,
                    });
                }

                if (!endpoints) continue;

                openingReflows.push({
                    ...openingAnn,
                    points: openingAnn.points.map((pt, i) => ({
                        ...pt,
                        x: i === 0 ? endpoints.p1.x : endpoints.p2.x,
                        y: i === 0 ? endpoints.p1.y : endpoints.p2.y,
                    })),
                });
            }
        }
        const mapped = affected.map(ann => {
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

            // C. Inner Steiner Points
            if (_ann.innerPoints?.some(pt => pt.id === movingPointId)) {
                _ann.innerPoints = _ann.innerPoints.map(pt =>
                    pt.id === movingPointId
                        ? { ...pt, x: currentPos.x, y: currentPos.y }
                        : pt
                );
            }

            // D. guideLines (resolved refs key on `pointId` AND mirror `id`)
            if (_ann.guideLines?.some(gl => gl?.points?.some(g => g.pointId === movingPointId || g.id === movingPointId))) {
                _ann.guideLines = _ann.guideLines.map(gl => ({
                    ...gl,
                    points: (gl?.points || []).map(g =>
                        (g.pointId === movingPointId || g.id === movingPointId)
                            ? { ...g, x: currentPos.x, y: currentPos.y }
                            : g
                    ),
                }));
            }

            // E. isoHeightLines (same resolved ref shape as guideLines)
            if (_ann.isoHeightLines?.some(l => l?.points?.some(g => g.pointId === movingPointId || g.id === movingPointId))) {
                _ann.isoHeightLines = _ann.isoHeightLines.map(l => ({
                    ...l,
                    points: (l?.points || []).map(g =>
                        (g.pointId === movingPointId || g.id === movingPointId)
                            ? { ...g, x: currentPos.x, y: currentPos.y }
                            : g
                    ),
                }));
            }

            return _ann;
        });

        return [...mapped, ...openingReflows];

    }, [annotations, movingPointId, currentPos, virtualInsertion, originalPointIdForDuplication, selectedAnnotationId, openingRels, baseMapMeterByPx]);

    if (modifiedAnnotations.length === 0) return null;

    return (
        <g className="transient-layer">
            {modifiedAnnotations.map(ann => {
                const isOpeningNode =
                    ann.drawingShape === "OPENING" ||
                    (ann.isOpening && ann.points?.length === 2);
                return <React.Fragment key={ann.id}>
                    {isOpeningNode && <NodeOpeningStatic
                        annotation={ann}
                        // Lighter tone than the host stroke so the moving
                        // ghost stays readable over the dragged wall preview
                        // (the static opening is hidden during the drag).
                        annotationOverride={{
                            strokeColor: (() => {
                                try {
                                    return lighten(ann.strokeColor || "#ff0000", 0.45);
                                } catch {
                                    return "#64b5f6";
                                }
                            })(),
                            strokeOpacity: 0.7,
                        }}
                        baseMapMeterByPx={baseMapMeterByPx}
                        isTransient={true}
                    />}

                    {!isOpeningNode && ["POLYGON", "POLYLINE", "REVOLUTION_AXIS"].includes(ann.type) && <NodePolylineStatic
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

                    {ann.type === "COTE" && <NodeCoteStatic
                        annotation={ann}
                        annotationOverride={{
                            strokeColor: "#2196f3",
                            strokeOpacity: 0.5,
                        }}
                        baseMapMeterByPx={baseMapMeterByPx}
                        containerK={containerK}
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