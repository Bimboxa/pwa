import { nanoid } from "@reduxjs/toolkit";

import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import { setOpenDialogCreateEntity, triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { setNewAnnotation, triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import getAnnotationTemplateFromNewAnnotation from "Features/annotations/utils/getAnnotationTemplateFromNewAnnotation";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import getAnnotationBBox from "Features/annotations/utils/getAnnotationBbox";
import mergePolygonAnnotationsService from "Features/annotations/services/mergePolygonAnnotationsService";


export default function useHandleCommitDrawing({ newEntity } = {}) {

    // dispatch

    const dispatch = useDispatch();

    // data

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);
    const newAnnotationInState = useSelector(s => s.annotations.newAnnotation);
    const openedPanel = useSelector(s => s.listings.openedPanel);
    const autoMergeOnCommit = useSelector(s => s.mapEditor.autoMergeOnCommit);
    const autoOffsetsOnCommit = useSelector(s => s.mapEditor.autoOffsetsOnCommit);
    const enabledDrawingMode = useSelector(s => s.mapEditor.enabledDrawingMode);
    // Vertical offset set from the 3D editor's basemap-position panel and
    // synced across tabs by syncTabsMiddleware. Applied to the new annotation
    // unless the auto-offsets pass already computed a value (which wins so
    // POLYGON_CLICK ramps over existing 3D geometry stay continuous).
    const drawingOffset = useSelector(s => s.threedEditor?.drawingOffset ?? 0);

    const createEntity = useCreateEntity();

    const updateAnnotation = useUpdateAnnotation();
    const createAnnotation = useCreateAnnotation();

    const baseMap = useMainBaseMap();
    const resetNewAnnotation = useResetNewAnnotation();
    const activeLayerId = useSelector(s => s.layers?.activeLayerId);
    const { value: selectedListing } = useSelectedListing();

    // helpers

    const isBaseMapAnnotation = openedPanel === "BASE_MAP_DETAIL";


    // main

    const handleDrawingCommit = async (rawPoints, options) => {

        let _newAnnotation; // created at the end.
        let _updatedAnnotation;

        // options

        const closeLine = options?.closeLine;
        const cutHostId = options?.cutHostId;
        const drawRectangle = options?.drawRectangle;
        const skipTemplateCreation = options?.skipTemplateCreation;
        const detectedCuts = options?.detectedCuts; // from polygon auto-detection

        // newAnnotation

        const newAnnotation = options?.newAnnotation ?? newAnnotationInState

        // update rawPoints for rectangle
        if (drawRectangle) {
            const P2 = { x: rawPoints[1].x, y: rawPoints[0].y }
            const P4 = { x: rawPoints[0].x, y: rawPoints[1].y }
            //rawPoints = [...rawPoints, P2, P4];
        }
        // image size

        const { width, height } = baseMap?.getImageSize?.() ?? {}

        // cuts

        if (newAnnotation.type === "CUT") {
            _updatedAnnotation = { ...await db.annotations.get(cutHostId) }
        }


        // ETAPE : création de l'entité ou non

        let entityId = newAnnotation?.entityId;
        if (!entityId && !isBaseMapAnnotation) {
            const entity = await createEntity(newEntity)
            entityId = entity.id;
        }

        // edge case
        if (newAnnotation.type === "LABEL" && rawPoints.length === 1) {
            // dispatch(setOpenDialogCreateEntity(true))
            // dispatch(setNewAnnotation({
            //     ...newAnnotation,
            //     entityId,
            //     targetPoint: { x: _x / width, y: _y / height },
            //     labelPoint: { x: (_x - 50) / width, y: (_y + 0) / height },
            //     baseMapId,
            //     projectId,
            //     listingId,
            // }))
            // return;
            const { x: _x, y: _y } = rawPoints[0];
            // on calcule le point central
            _newAnnotation = {
                ...newAnnotation,
                id: nanoid(),
                entityId,
                targetPoint: { x: _x / width, y: _y / height },
                labelPoint: { x: (_x - 50) / width, y: (_y + 0) / height },
                baseMapId,
                projectId,
                listingId,
                ...(activeLayerId && !isBaseMapAnnotation ? { layerId: activeLayerId } : {}),

                // ... props de style
            };
        }

        else {
            // rawPoints = [{x,y, existingPointId?}, {x,y}, ...]


            const finalPointIds = [];
            const newPointsToSave = []; // Batch pour Dexie

            // ÉTAPE 1 : Résolution des Points (Geometry)
            for (const pt of rawPoints) {
                if (pt.existingPointId) {
                    // Cas A : On réutilise un point existant (Topologie partagée !)
                    finalPointIds.push(pt.existingPointId);
                } else {
                    // Cas B : C'est un nouveau point
                    const newId = nanoid(); // Générer un ID client-side

                    const newPointEntity = {
                        id: newId,
                        x: pt.x / width,
                        y: pt.y / height,
                        baseMapId,
                        projectId,
                        listingId,
                        forMarker: newAnnotation?.type === "MARKER",
                    };

                    newPointsToSave.push(newPointEntity);
                    finalPointIds.push(newId);
                }
            }

            // ÉTAPE 1bis : Auto-offsets — compute annotation offsetZ/height + per-point
            // offsetBottom/offsetTop so a POLYGON_CLICK drawn over existing 3D
            // annotations stays continuous in 3D (ramp). Per-vertex offsets are
            // stored inline on _newAnnotation.points (per-annotation, not on db.points),
            // matching the resolvePoints contract.
            //
            // Strategy: align orange's bottom/top with the lowest neighbor, then lift
            // higher-neighbor vertices via positive offsetBottom / offsetTop. This keeps
            // orange.height equal to the lowest neighbor's height and produces a ramp
            // toward higher neighbors.
            let _autoOffsets = null;
            const _autoPointOffsets = {}; // rawPointIdx → { offsetBottom?, offsetTop? }
            const shouldApplyAutoOffsets = (
                autoOffsetsOnCommit &&
                enabledDrawingMode === "POLYGON_CLICK" &&
                newAnnotation?.type === "POLYGON"
            );
            if (shouldApplyAutoOffsets) {
                // Build a per-rawPoint link descriptor (parent annotation + optional parent point id).
                const linkByIdx = new Array(rawPoints.length).fill(null);
                const annIds = new Set();
                const parentPointIds = new Set();
                for (let i = 0; i < rawPoints.length; i++) {
                    const pt = rawPoints[i];
                    if (pt.existingPointId) {
                        linkByIdx[i] = { parentPointId: pt.existingPointId, parentAnnotationId: null };
                        parentPointIds.add(pt.existingPointId);
                    } else if (pt.snapSegment?.annotationId) {
                        linkByIdx[i] = {
                            parentAnnotationId: pt.snapSegment.annotationId,
                            parentPointId: null,
                        };
                        annIds.add(pt.snapSegment.annotationId);
                    }
                }

                // Resolve parent annotations for existingPointId snaps by scanning candidate
                // annotations on the same baseMap that reference these point ids. We also
                // capture the inline offsetBottom/offsetTop for each (parentAnnotationId,
                // parentPointId) pair, since offsets are stored inline on annotation.points.
                const inlineOffsetByLinkIdx = {}; // i → { offsetBottom, offsetTop } from parent annotation's inline entry
                const remainingByPointId = {};
                for (let i = 0; i < linkByIdx.length; i++) {
                    const link = linkByIdx[i];
                    if (link?.parentPointId && !link.parentAnnotationId) {
                        if (!remainingByPointId[link.parentPointId]) remainingByPointId[link.parentPointId] = [];
                        remainingByPointId[link.parentPointId].push(i);
                    }
                }
                if (Object.keys(remainingByPointId).length > 0) {
                    const baseMapAnnotations = await db.annotations
                        .where("baseMapId")
                        .equals(baseMapId)
                        .filter((a) => !a.deletedAt)
                        .toArray();
                    for (const a of baseMapAnnotations) {
                        const inlineRefs = [
                            ...(a.points ?? []),
                            ...((a.cuts ?? []).flatMap((c) => c.points ?? [])),
                        ];
                        for (const r of inlineRefs) {
                            const idxs = remainingByPointId[r?.id];
                            if (!idxs) continue;
                            for (const idx of idxs) {
                                if (linkByIdx[idx].parentAnnotationId) continue;
                                linkByIdx[idx].parentAnnotationId = a.id;
                                annIds.add(a.id);
                                inlineOffsetByLinkIdx[idx] = {
                                    offsetBottom: Number(r?.offsetBottom) || 0,
                                    offsetTop: Number(r?.offsetTop) || 0,
                                };
                            }
                        }
                    }
                }

                const annsArr = annIds.size > 0
                    ? await db.annotations.bulkGet([...annIds])
                    : [];
                const annIndex = {};
                for (const a of annsArr) if (a) annIndex[a.id] = a;

                // Compute effective bottom/top Z per linked drawing point.
                const linkedZ = []; // [{ idx, bottomZ, topZ }]
                for (let i = 0; i < linkByIdx.length; i++) {
                    const link = linkByIdx[i];
                    if (!link?.parentAnnotationId) continue;
                    const parentAnn = annIndex[link.parentAnnotationId];
                    if (!parentAnn) continue;
                    const parentOffsetZ = Number(parentAnn.offsetZ) || 0;
                    const parentHeight = Number(parentAnn.height) || 0;
                    const inlineOff = inlineOffsetByLinkIdx[i] ?? { offsetBottom: 0, offsetTop: 0 };
                    linkedZ.push({
                        idx: i,
                        bottomZ: parentOffsetZ + inlineOff.offsetBottom,
                        topZ: parentOffsetZ + parentHeight + inlineOff.offsetTop,
                    });
                }

                if (linkedZ.length > 0) {
                    // The renderer (triangulateAnnotationGeometry.js) computes
                    //   bottom_z = verticalLift + offsetBottom
                    //   top_z    = verticalLift + height + offsetBottom + offsetTop
                    // so a vertex's "thickness" = height + offsetTop (offsetBottom
                    // shifts both faces). To make orange match every neighbor at
                    // both faces, we pick:
                    //   newOffsetZ = min(bottomZ)
                    //   newHeight  = min(thickness)   ← thinnest neighbor sets the base height
                    //   offB_i     = bottomZ_i  − newOffsetZ        (≥ 0)
                    //   offT_i     = thickness_i − newHeight        (≥ 0)
                    let minBottom = Infinity;
                    let minThickness = Infinity;
                    for (const z of linkedZ) {
                        if (z.bottomZ < minBottom) minBottom = z.bottomZ;
                        const t = z.topZ - z.bottomZ;
                        if (t < minThickness) minThickness = t;
                    }
                    const newOffsetZ = minBottom;
                    const newHeight = Math.max(0, minThickness);
                    _autoOffsets = { offsetZ: newOffsetZ, height: newHeight };

                    for (const z of linkedZ) {
                        const offB = z.bottomZ - newOffsetZ;
                        const offT = (z.topZ - z.bottomZ) - newHeight;
                        const entry = {};
                        if (offB !== 0) entry.offsetBottom = offB;
                        if (offT !== 0) entry.offsetTop = offT;
                        if (Object.keys(entry).length > 0) {
                            _autoPointOffsets[z.idx] = entry;
                        }
                    }
                }
            }

            // ÉTAPE 2 : Sauvegarde des Nouveaux Points (Batch)
            if (newPointsToSave.length > 0) {
                await db.points.bulkAdd(newPointsToSave);
            }

            // ÉTAPE 2.1 : Insert snapped points into target annotations' segments
            // When a drawing point was snapped to a PROJECTION/MIDPOINT on an existing
            // annotation segment, we insert the new shared point into that segment.
            const snapInsertions = [];
            for (let idx = 0; idx < rawPoints.length; idx++) {
                const pt = rawPoints[idx];
                if (pt.snapSegment && !pt.existingPointId) {
                    snapInsertions.push({
                        pointId: finalPointIds[idx],
                        annotationId: pt.snapSegment.annotationId,
                        segmentStartId: pt.snapSegment.segmentStartId,
                        segmentEndId: pt.snapSegment.segmentEndId,
                        cutIndex: pt.snapSegment.cutIndex,
                    });
                }
            }

            if (snapInsertions.length > 0) {
                const insertPointInPath = (pointsList, segStartId, segEndId, newPointObj) => {
                    if (!pointsList || pointsList.length < 2) return null;
                    for (let i = 0; i < pointsList.length; i++) {
                        const cur = pointsList[i];
                        const next = pointsList[(i + 1) % pointsList.length];
                        if ((cur.id === segStartId && next.id === segEndId) ||
                            (cur.id === segEndId && next.id === segStartId)) {
                            // Skip arc segments: inserting a point would break the arc geometry
                            if (cur.type === 'circle' || next.type === 'circle') return null;
                            const newPoints = [...pointsList];
                            newPoints.splice(i + 1, 0, newPointObj);
                            return newPoints;
                        }
                    }
                    return null;
                };

                // Group insertions by annotation to avoid conflicting updates
                const byAnnotation = {};
                for (const ins of snapInsertions) {
                    if (!byAnnotation[ins.annotationId]) byAnnotation[ins.annotationId] = [];
                    byAnnotation[ins.annotationId].push(ins);
                }

                for (const [annId, insertions] of Object.entries(byAnnotation)) {
                    const ann = await db.annotations.get(annId);
                    if (!ann) continue;

                    let updatedPoints = ann.points ? [...ann.points] : null;
                    let updatedCuts = ann.cuts ? ann.cuts.map(c => ({ ...c, points: [...c.points] })) : null;

                    for (const ins of insertions) {
                        const newPointObj = { id: ins.pointId, type: 'square' };
                        if (ins.cutIndex != null && updatedCuts?.[ins.cutIndex]) {
                            const result = insertPointInPath(updatedCuts[ins.cutIndex].points, ins.segmentStartId, ins.segmentEndId, newPointObj);
                            if (result) updatedCuts[ins.cutIndex].points = result;
                        } else if (updatedPoints) {
                            const result = insertPointInPath(updatedPoints, ins.segmentStartId, ins.segmentEndId, newPointObj);
                            if (result) updatedPoints = result;
                        }
                    }

                    const changes = {};
                    if (updatedPoints) changes.points = updatedPoints;
                    if (updatedCuts) changes.cuts = updatedCuts;
                    if (Object.keys(changes).length > 0) {
                        await db.annotations.update(annId, changes);
                    }
                }
            }

            let annotationTemplateId;
            // ÉTAPE 2.5 : Enregistrement de l'annotation template
            if (newAnnotation && !_updatedAnnotation && !isBaseMapAnnotation && !skipTemplateCreation) {
                const existingAnnotationTemplates = await db.annotationTemplates.where("listingId").equals(listingId).toArray();
                // const existingAnnotationTemplate = getAnnotationTemplateFromNewAnnotation({
                //     newAnnotation,
                //     annotationTemplates: existingAnnotationTemplates,
                // });
                const existingAnnotationTemplate = existingAnnotationTemplates.find(t => t.id === newAnnotation.annotationTemplateId);
                if (existingAnnotationTemplate) {
                    annotationTemplateId = existingAnnotationTemplate.id;
                } else {
                    annotationTemplateId = nanoid();
                    const _annotationTemplate = {
                        id: annotationTemplateId,
                        projectId,
                        listingId,
                        ...newAnnotation,
                    }
                    await db.annotationTemplates.add(_annotationTemplate);

                }
            }


            // ETAPE 3 : update annotation cuts

            if (_updatedAnnotation) {
                const cut = {
                    points: finalPointIds.map((id, i) => {
                        const entry = { id };
                        if (rawPoints[i]?.type) entry.type = rawPoints[i].type;
                        return entry;
                    }),
                };
                if (newAnnotation.label) cut.label = newAnnotation.label;
                const newCuts = _updatedAnnotation?.cuts ? [..._updatedAnnotation?.cuts, cut] : [cut];
                _updatedAnnotation = {
                    ..._updatedAnnotation,
                    cuts: newCuts,
                };
            }

            // ÉTAPE 3 : Création de l'Annotation (Topologie)
            _newAnnotation = {
                ...newAnnotation,
                id: nanoid(),
                annotationTemplateId,
                entityId,
                //points: finalPointIds.map(id => ({ id })), // Référence uniquement les IDs !
                baseMapId,
                projectId,
                listingId,
                ...(activeLayerId && !isBaseMapAnnotation ? { layerId: activeLayerId } : {}),

                // ... props de style
            };


            if (isBaseMapAnnotation) _newAnnotation.isBaseMapAnnotation = true;

            if (closeLine) _newAnnotation.closeLine = true;

            if (["POLYGON", "POLYLINE", "STRIP"].includes(newAnnotation?.type)) {
                _newAnnotation.points = finalPointIds.map((id, i) => {
                    const entry = { id };
                    if (rawPoints[i]?.type) entry.type = rawPoints[i].type;
                    const auto = _autoPointOffsets[i];
                    if (auto?.offsetBottom != null) entry.offsetBottom = auto.offsetBottom;
                    if (auto?.offsetTop != null) entry.offsetTop = auto.offsetTop;
                    return entry;
                });
            }

            // Handle detected cuts from polygon auto-detection
            if (detectedCuts && detectedCuts.length > 0 && width && height) {
                const cutEntries = [];
                const allCutPointsToSave = [];
                for (const cutRing of detectedCuts) {
                    if (!cutRing || cutRing.length < 3) continue;
                    const cutPointIds = [];
                    for (const pt of cutRing) {
                        const newId = nanoid();
                        allCutPointsToSave.push({
                            id: newId,
                            x: pt.x / width,
                            y: pt.y / height,
                            baseMapId,
                            projectId,
                            listingId,
                        });
                        cutPointIds.push(newId);
                    }
                    cutEntries.push({
                        points: cutPointIds.map(id => ({ id })),
                    });
                }
                // Single bulk insert for all cut points
                if (allCutPointsToSave.length > 0) {
                    await db.points.bulkAdd(allCutPointsToSave);
                }
                if (cutEntries.length > 0) {
                    _newAnnotation.cuts = cutEntries;
                }
            }

            if (drawRectangle) {
                _newAnnotation.bbox = {
                    x: rawPoints[0].x / width,
                    y: rawPoints[0].y / height,
                    width: (rawPoints[1].x - rawPoints[0].x) / width,
                    height: (rawPoints[1].y - rawPoints[0].y) / height,
                }
            }

            if (newAnnotation?.type === "MARKER" || newAnnotation?.type === "POINT") {
                _newAnnotation.point = { id: finalPointIds[0] };
            }

            if (_autoOffsets) {
                _newAnnotation.offsetZ = _autoOffsets.offsetZ;
                _newAnnotation.height = _autoOffsets.height;
            } else if (drawingOffset !== 0) {
                _newAnnotation.offsetZ = drawingOffset;
            }
        }



        // Mise à jour Optimiste Redux
        //dispatch(addAnnotation(newAnnotation));
        // Sauvegarde DB
        if (_updatedAnnotation) {
            await updateAnnotation(_updatedAnnotation);
        } else {
            await createAnnotation(_newAnnotation);
        }


        // Auto-merge : on commit of a POLYGON drawn via the RECTANGLE tool, try to
        // absorb overlapping same-template polygons on the same baseMap / listing.
        // The newly-committed polygon stays as the winner.
        const shouldAutoMerge = (
            autoMergeOnCommit &&
            enabledDrawingMode === "POLYGON_RECTANGLE" &&
            newAnnotation?.type === "POLYGON" &&
            _newAnnotation?.annotationTemplateId &&
            !isBaseMapAnnotation
        );

        if (shouldAutoMerge) {
            const candidateRaws = await db.annotations
                .where("annotationTemplateId")
                .equals(_newAnnotation.annotationTemplateId)
                .filter((a) =>
                    !a.deletedAt &&
                    a.type === "POLYGON" &&
                    a.id !== _newAnnotation.id &&
                    a.baseMapId === _newAnnotation.baseMapId &&
                    a.listingId === _newAnnotation.listingId
                )
                .toArray();

            if (candidateRaws.length > 0 && width && height) {
                const pointIds = new Set();
                for (const a of [_newAnnotation, ...candidateRaws]) {
                    (a.points ?? []).forEach((p) => p?.id && pointIds.add(p.id));
                    (a.cuts ?? []).forEach((c) =>
                        c.points?.forEach((p) => p?.id && pointIds.add(p.id))
                    );
                }

                const pointsArr = await db.points.bulkGet([...pointIds]);
                const pointsIndex = {};
                for (const p of pointsArr) if (p) pointsIndex[p.id] = p;

                const imageSize = { width, height };
                const resolveAnnotation = (a) => ({
                    ...a,
                    points: resolvePoints({ points: a.points, pointsIndex, imageSize }),
                    cuts: resolveCuts({ cuts: a.cuts, pointsIndex, imageSize }) ?? a.cuts,
                });

                const newResolved = resolveAnnotation(_newAnnotation);
                const newBbox = getAnnotationBBox(newResolved);

                if (newBbox) {
                    const TOL = 2;
                    const candidatesResolved = candidateRaws
                        .map(resolveAnnotation)
                        .filter((a) => {
                            const bb = getAnnotationBBox(a);
                            if (!bb) return false;
                            return (
                                bb.x + bb.width >= newBbox.x - TOL &&
                                bb.x <= newBbox.x + newBbox.width + TOL &&
                                bb.y + bb.height >= newBbox.y - TOL &&
                                bb.y <= newBbox.y + newBbox.height + TOL
                            );
                        });

                    if (candidatesResolved.length > 0) {
                        const result = await mergePolygonAnnotationsService(
                            [newResolved, ...candidatesResolved],
                            {
                                baseMap,
                                activeLayerId,
                                winnerIndex: 0,
                                dilationSchedule: [2],
                            }
                        );
                        if (result.merged) {
                            dispatch(triggerAnnotationsUpdate());
                        }
                    }
                }
            }
        }



        // Reset
        //resetNewAnnotation();


    }

    return { handleDrawingCommit };
}