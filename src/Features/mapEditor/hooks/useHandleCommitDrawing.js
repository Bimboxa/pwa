import { useRef } from "react";

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
import avoidVisibleAnnotationsService from "Features/annotations/services/avoidVisibleAnnotationsService";
import applyOpeningOnPolygon from "Features/annotations/utils/applyOpeningOnPolygon";
import findCutHostAnnotationId from "Features/annotations/utils/findCutHostAnnotationId";
import addAnnotationOpening from "Features/annotations/services/addAnnotationOpening";
import deriveOpeningContourAnchor from "Features/mapEditor/utils/deriveOpeningContourAnchor";
import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import createRevolutionProxiesOnPlan from "Features/elevation/services/createRevolutionProxiesOnPlan";

// Module-level cache of the per-listing annotationTemplates query (ÉTAPE 2.5
// below): the query ran on EVERY drawing commit (~30ms of IDB on slow
// machines) for a table that rarely changes. Invalidated by the Dexie hooks
// (same pattern and same same-tab-only limitation as _listingsCache in
// useAnnotationsV2).
const _templatesByListingCache = new Map(); // listingId -> Promise<templates[]>
{
    const _clearTemplatesCache = () => _templatesByListingCache.clear();
    db.annotationTemplates.hook("creating", _clearTemplatesCache);
    db.annotationTemplates.hook("updating", _clearTemplatesCache);
    db.annotationTemplates.hook("deleting", _clearTemplatesCache);
}
const getTemplatesForListing = (listingId) => {
    let p = _templatesByListingCache.get(listingId);
    if (!p) {
        p = db.annotationTemplates
            .where("listingId")
            .equals(listingId)
            .toArray()
            .catch((e) => {
                _templatesByListingCache.delete(listingId);
                throw e;
            });
        _templatesByListingCache.set(listingId, p);
    }
    return p;
};

export default function useHandleCommitDrawing({ newEntity, annotations } = {}) {

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
    const avoidVisibleAnnotationsOnCommit = useSelector(s => s.mapEditor.avoidVisibleAnnotationsOnCommit);
    const enabledDrawingMode = useSelector(s => s.mapEditor.enabledDrawingMode);

    // Visible annotations come from useAnnotationsV2 in the caller — that's
    // the single source of truth for what "visible" means (soft-delete,
    // layer/template/listing visibility, solo mode, baseMap filter).
    // The avoid-visible-annotations feature only adds an annotationTemplateId
    // filter on top.
    const annotationsRef = useRef(annotations);
    annotationsRef.current = annotations;
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

        // Revolution helpers (REVOLUTION_AXIS / REVOLUTION_POINT) are standalone
        // annotations: no entity, no per-instance template. They are kept in the
        // selected listing so they pass the scope filter in useAnnotationsV2.
        const isRevolutionHelper =
            newAnnotation?.type === "REVOLUTION_AXIS" ||
            newAnnotation?.type === "REVOLUTION_POINT";

        // update rawPoints for rectangle
        if (drawRectangle) {
            const P2 = { x: rawPoints[1].x, y: rawPoints[0].y }
            const P4 = { x: rawPoints[0].x, y: rawPoints[1].y }
            //rawPoints = [...rawPoints, P2, P4];
        }
        // image size

        const { width, height } = baseMap?.getImageSize?.() ?? {}

        // OPENING_SEGMENT (template-driven opening placement): the 2 raw points
        // are the opening segment glued on the host wall. The host carve runs
        // in a dedicated block below, then the commit FALLS THROUGH to the
        // normal creation path so a 2-point POLYLINE opening annotation is
        // persisted and linked to its host via relAnnotationOpenings.
        const isOpeningSegmentCommit =
            enabledDrawingMode === "OPENING_SEGMENT" && rawPoints?.length === 2;

        // cuts

        if ((newAnnotation.type === "CUT" || newAnnotation.isOpening) && !isOpeningSegmentCommit) {
            // Opening-from-centerline tools (CUT_POLYLINE / CUT_STRIP …) draw a
            // POLYLINE / STRIP centerline; polygonize it into the band contour
            // (centered band for POLYLINE, one-sided offset band for STRIP) and
            // use that as the opening polygon so the rest of the CUT pipeline
            // (host detection, applyOpeningOnPolygon, inner-ring fallback) runs
            // unchanged on the band.
            if (newAnnotation.isOpening) {
                const polys = getAnnotationAsPolygons(
                    {
                        type: newAnnotation.type,
                        points: rawPoints,
                        strokeWidth: newAnnotation.strokeWidth,
                        strokeWidthUnit: newAnnotation.strokeWidthUnit,
                        stripOrientation: newAnnotation.stripOrientation,
                        closeLine,
                    },
                    { meterByPx: baseMap?.getMeterByPx?.() }
                );
                const contour = polys?.[0]?.points;
                if (!contour || contour.length < 3) return;
                rawPoints = contour.map((p) => ({ x: p.x, y: p.y }));
            }

            // The host is normally captured by the first-click DOM hit-test in
            // InteractionLayer (cutHostId). When the user starts the rectangle
            // on the polygon border instead of inside it, that hit-test misses
            // and cutHostId stays null — resolve the host geometrically from
            // the drawn opening so the same downstream pattern still applies.
            let _cutHostId = cutHostId;
            if (!_cutHostId && rawPoints?.length >= 3) {
                _cutHostId = findCutHostAnnotationId({
                    openingPx: rawPoints,
                    annotations: annotationsRef.current,
                    meterByPx: baseMap?.getMeterByPx?.(),
                });
            }
            _updatedAnnotation = _cutHostId
                ? { ...(await db.annotations.get(_cutHostId)) }
                : null;
            if (_updatedAnnotation?.type !== "POLYGON") return; // openings only apply to POLYGON hosts

            // When the drawn opening touches or exits the host polygon's outer
            // boundary, we modify the outer contour (carving a notch) instead
            // of appending a hole. See [annotations] issue #224.
            if (_updatedAnnotation?.id && rawPoints?.length >= 3) {
                const contourResult = await applyOpeningOnPolygon({
                    host: _updatedAnnotation,
                    // Keep the arc `type` so a circular opening (CUT_CIRCLE) that
                    // exits the host carves a rounded edge instead of a diamond.
                    openingPointsPx: rawPoints.map((p) =>
                        p.type
                            ? { x: p.x, y: p.y, type: p.type }
                            : { x: p.x, y: p.y }
                    ),
                    imageSize: { width, height },
                    baseMapId,
                    projectId,
                    listingId,
                });
                if (contourResult?.handled) {
                    if (contourResult.updatedAnnotation) {
                        await updateAnnotation(contourResult.updatedAnnotation);
                    }
                    return;
                }
            }
        }


        // DEFERRED commit writes: every write of this commit (point rows,
        // snap-insertion updates, annotation, mapping rels) lands in ONE
        // Dexie transaction at the final create/update below → a single
        // invalidation + a single liveQuery re-run wave (instead of one per
        // write), and no orphaned point rows when the commit bails out on an
        // early return (carve/merge paths).
        const pendingPointRows = [];
        const pendingAnnotationUpdates = [];

        // OPENING_SEGMENT: carve the host wall with the opening band before the
        // normal creation path persists the 2-point opening annotation.
        // `openingCarve` records how the host was carved so the reflow service
        // can refresh the notch/cut when the host moves; `openingAnchor` holds
        // the (possibly re-derived) host anchor written to relAnnotationOpenings.
        let openingCarve = null;
        let openingAnchor = null;
        const openingHostId = options?.openingHostId;
        if (isOpeningSegmentCommit && openingHostId && width && height) {
            openingCarve = { mode: "NONE" };
            openingAnchor = {
                hostSegmentStartPointId: options?.openingHostSegmentStartPointId,
                hostSegmentEndPointId: options?.openingHostSegmentEndPointId,
                hostArcControlPointId: options?.openingHostArcControlPointId ?? null,
                hostDistanceM: options?.openingHostDistanceM,
            };

            const host = await db.annotations.get(openingHostId);
            if (host?.type === "POLYGON") {
                // Band polygon across the wall: length = the opening segment,
                // thickness = the template strokeWidth (CM).
                const polys = getAnnotationAsPolygons(
                    {
                        type: "POLYLINE",
                        points: rawPoints,
                        strokeWidth: newAnnotation.strokeWidth,
                        strokeWidthUnit: newAnnotation.strokeWidthUnit,
                    },
                    { meterByPx: baseMap?.getMeterByPx?.() }
                );
                const bandPx = polys?.[0]?.points?.map((p) => ({ x: p.x, y: p.y }));

                if (bandPx?.length >= 3) {
                    const contourResult = await applyOpeningOnPolygon({
                        host,
                        openingPointsPx: bandPx,
                        imageSize: { width, height },
                        baseMapId,
                        projectId,
                        listingId,
                    });
                    if (contourResult?.handled) {
                        if (contourResult.updatedAnnotation) {
                            await updateAnnotation(contourResult.updatedAnnotation);
                            // The carve re-minted every ring point id — re-derive
                            // the anchor ids + notch ids on the carved ring.
                            const derived = deriveOpeningContourAnchor({
                                ringRefs: contourResult.updatedAnnotation.points,
                                pxById: contourResult.newPointsPxById,
                                segStartPx: options?.openingHostSegStartPx,
                                segEndPx: options?.openingHostSegEndPx,
                                bandPx,
                            });
                            openingCarve = {
                                mode: "CONTOUR",
                                notchPointIds: derived.notchPointIds,
                            };
                            if (derived.startId) {
                                openingAnchor.hostSegmentStartPointId = derived.startId;
                            }
                            if (derived.endId) {
                                openingAnchor.hostSegmentEndPointId = derived.endId;
                            }
                        }
                    } else {
                        // Band strictly inside the host → append an inner-ring cut.
                        const cutId = nanoid();
                        const cutRefs = bandPx.map((p) => {
                            const id = nanoid();
                            pendingPointRows.push({
                                id,
                                x: p.x / width,
                                y: p.y / height,
                                baseMapId,
                                projectId,
                                listingId,
                            });
                            return { id };
                        });
                        pendingAnnotationUpdates.push({
                            id: host.id,
                            changes: {
                                cuts: [...(host.cuts ?? []), { id: cutId, points: cutRefs }],
                            },
                        });
                        openingCarve = { mode: "CUT", cutId };
                    }
                }
            }
        }

        // ETAPE : création de l'entité ou non

        let entityId = newAnnotation?.entityId;
        const isFreeAnnotation = newAnnotation?.isFreeAnnotation;
        // Zone delimitation polygons live in a ZONING listing whose table is
        // `zones` — creating an entity there would write a garbage zone row.
        const isZoneAnnotation = newAnnotation?.isZoneAnnotation;
        if (!entityId && !isBaseMapAnnotation && !isRevolutionHelper && !isFreeAnnotation && !isZoneAnnotation) {
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

            // ÉTAPE 2 : new points — DEFERRED write (see pendingPointRows
            // declaration above).
            if (newPointsToSave.length > 0) {
                pendingPointRows.push(...newPointsToSave);
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
                        // deferred to the final commit transaction (the snapped
                        // point row is deferred too — committing this update
                        // alone would transiently reference a missing point)
                        pendingAnnotationUpdates.push({ id: annId, changes });
                    }
                }
            }

            let annotationTemplateId;
            // ÉTAPE 2.5 : Enregistrement de l'annotation template
            if (newAnnotation && !_updatedAnnotation && !isBaseMapAnnotation && !skipTemplateCreation && !isRevolutionHelper) {
                const existingAnnotationTemplates = await getTemplatesForListing(listingId);
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

            if (["POLYGON", "POLYLINE", "STRIP", "COTE", "REVOLUTION_AXIS"].includes(newAnnotation?.type)) {
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
                    const cutPoints = []; // { id, type? } — preserve arc types
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
                        cutPoints.push({ id: newId, type: pt.type });
                    }
                    cutEntries.push({
                        points: cutPoints.map(({ id, type }) => (type ? { id, type } : { id })),
                    });
                }
                // deferred to the final commit transaction
                if (allCutPointsToSave.length > 0) {
                    pendingPointRows.push(...allCutPointsToSave);
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

            if (
                newAnnotation?.type === "MARKER" ||
                newAnnotation?.type === "POINT" ||
                newAnnotation?.type === "REVOLUTION_POINT"
            ) {
                _newAnnotation.point = { id: finalPointIds[0] };
            }

            // Auto-numbered default label for revolution axes ("Axe 1", "Axe 2"…)
            // so they are immediately identifiable in the edit toolbar / selectors.
            if (newAnnotation?.type === "REVOLUTION_AXIS" && !_newAnnotation.label) {
                const existingAxesCount = await db.annotations
                    .where("projectId")
                    .equals(projectId)
                    .filter((a) => a.type === "REVOLUTION_AXIS" && !a.deletedAt)
                    .count();
                _newAnnotation.label = `Axe ${existingAxesCount + 1}`;
            }

            if (_autoOffsets) {
                _newAnnotation.offsetZ = _autoOffsets.offsetZ;
                _newAnnotation.height = _autoOffsets.height;
            } else if (drawingOffset !== 0) {
                _newAnnotation.offsetZ = drawingOffset;
            }
        }


        // Avoid visible annotations: subtract every visible different-template
        // annotation from the drawn POLYGON. Outer overlaps modify the
        // contour; fully enclosed clips become cuts. POLYLINE/STRIP candidates
        // are polygonized via getAnnotationAsPolygons (band of width strokeWidth).
        const shouldAvoid = (
            avoidVisibleAnnotationsOnCommit &&
            ["POLYGON_RECTANGLE", "POLYGON_CLICK", "SURFACE_DROP"].includes(enabledDrawingMode) &&
            _newAnnotation?.type === "POLYGON" &&
            _newAnnotation?.annotationTemplateId &&
            !_updatedAnnotation &&
            !isBaseMapAnnotation &&
            width && height
        );

        if (shouldAvoid) {
            // Source candidates from useAnnotationsV2 (visible-filtered list
            // passed in by MainMapEditorV3). The only additional filter we
            // apply is `annotationTemplateId` mismatch.
            const visibleAnnotations = annotationsRef.current ?? [];
            const candidateRaws = visibleAnnotations.filter((a) =>
                a &&
                a.id !== _newAnnotation.id &&
                a.baseMapId === _newAnnotation.baseMapId &&
                a.annotationTemplateId &&
                a.annotationTemplateId !== _newAnnotation.annotationTemplateId &&
                ["POLYGON", "POLYLINE", "STRIP"].includes(a.type)
            );

            if (candidateRaws.length > 0) {
                const pointIds = new Set();
                for (const a of candidateRaws) {
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

                // Build drawn shape in pixel space from in-memory rawPoints / finalPointIds.
                // Keep `type: "circle"` so the service tessellates S-C-S arcs
                // instead of clipping along the chord of their control points.
                const drawnPoints = (_newAnnotation.points ?? [])
                    .map((p, i) => ({
                        id: p.id,
                        x: rawPoints[i]?.x,
                        y: rawPoints[i]?.y,
                        ...(p.type === "circle" && { type: "circle" }),
                    }))
                    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

                let drawnCuts = [];
                if (_newAnnotation.cuts && _newAnnotation.cuts.length > 0) {
                    const cutPtIds = new Set();
                    for (const c of _newAnnotation.cuts) {
                        (c.points ?? []).forEach((p) => p?.id && cutPtIds.add(p.id));
                    }
                    const cutPtsArr = await db.points.bulkGet([...cutPtIds]);
                    const cutPtsIndex = {};
                    for (const p of cutPtsArr) if (p) cutPtsIndex[p.id] = p;
                    drawnCuts = _newAnnotation.cuts.map((c) => ({
                        ...c,
                        points: (c.points ?? [])
                            .map((ref) => {
                                const stored = cutPtsIndex[ref.id];
                                if (!stored) return null;
                                return {
                                    id: ref.id,
                                    x: stored.x * width,
                                    y: stored.y * height,
                                    ...(ref.type === "circle" && { type: "circle" }),
                                };
                            })
                            .filter(Boolean),
                    }));
                }

                const drawnShape = { points: drawnPoints, cuts: drawnCuts };
                const drawnBbox = getAnnotationBBox(drawnShape);

                if (drawnBbox && drawnPoints.length >= 3) {
                    const TOL = 2;
                    const candidatesResolved = candidateRaws
                        .map(resolveAnnotation)
                        .filter((a) => {
                            const bb = getAnnotationBBox(a);
                            if (!bb) return false;
                            return (
                                bb.x + bb.width >= drawnBbox.x - TOL &&
                                bb.x <= drawnBbox.x + drawnBbox.width + TOL &&
                                bb.y + bb.height >= drawnBbox.y - TOL &&
                                bb.y <= drawnBbox.y + drawnBbox.height + TOL
                            );
                        });

                    if (candidatesResolved.length > 0) {
                        const carved = avoidVisibleAnnotationsService({
                            drawnShape,
                            candidates: candidatesResolved,
                            baseMap,
                        });

                        if (carved.consumed) {
                            // Drawn polygon fully consumed → skip the commit.
                            return;
                        }

                        // Rebuild point-id refs: reuse existing drawn-point ids when
                        // geometry matches; mint new ids (and save to db.points) for
                        // boolean-intersection vertices.
                        const keyOf = (x, y) =>
                            `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
                        const drawnPxLookup = new Map();
                        for (const p of drawnPoints) drawnPxLookup.set(keyOf(p.x, p.y), p.id);
                        for (const c of drawnCuts) {
                            for (const p of (c.points ?? [])) {
                                if (p?.id) drawnPxLookup.set(keyOf(p.x, p.y), p.id);
                            }
                        }

                        // Refs keep `type: "circle"` so recovered S-C-S arcs stay arcs.
                        const asRef = (id, px) =>
                            px.type === "circle" ? { id, type: "circle" } : { id };

                        const carvedPointsToSave = [];
                        const findOrMint = (px) => {
                            const k = keyOf(px.x, px.y);
                            const existing = drawnPxLookup.get(k);
                            if (existing) return asRef(existing, px);
                            const newId = nanoid();
                            carvedPointsToSave.push({
                                id: newId,
                                x: px.x / width,
                                y: px.y / height,
                                baseMapId,
                                projectId,
                                listingId,
                            });
                            drawnPxLookup.set(k, newId);
                            return asRef(newId, px);
                        };

                        const newPointsRefs = (carved.points ?? []).map(findOrMint);
                        const newCutsRefs = (carved.cuts ?? []).map((c) => {
                            const ref = { id: c.id, points: (c.points ?? []).map(findOrMint) };
                            if (c.label != null) ref.label = c.label;
                            if (c.type != null) ref.type = c.type;
                            if (c.hiddenSegmentsIdx != null) ref.hiddenSegmentsIdx = c.hiddenSegmentsIdx;
                            if (c.isoHeightSegmentsIdx != null) ref.isoHeightSegmentsIdx = c.isoHeightSegmentsIdx;
                            if (c.isExtEdgeSegmentsIdx != null) ref.isExtEdgeSegmentsIdx = c.isExtEdgeSegmentsIdx;
                            return ref;
                        });

                        if (carvedPointsToSave.length > 0) {
                            // deferred to the final commit transaction
                            pendingPointRows.push(...carvedPointsToSave);
                        }

                        _newAnnotation.points = newPointsRefs;
                        _newAnnotation.cuts = newCutsRefs;
                    }
                }
            }
        }


        // Mise à jour Optimiste Redux
        //dispatch(addAnnotation(newAnnotation));
        // Sauvegarde DB — single transaction: deferred point rows + snap
        // updates + annotation (+ mapping rels) commit atomically, so the
        // liveQueries re-run once per drawing commit.
        if (_updatedAnnotation) {
            await updateAnnotation(_updatedAnnotation, {
                pointRowsToSave: pendingPointRows,
                annotationUpdatesInTx: pendingAnnotationUpdates,
            });
        } else {
            await createAnnotation(_newAnnotation, {
                pointRowsToSave: pendingPointRows,
                annotationUpdatesInTx: pendingAnnotationUpdates,
            });
        }

        // OPENING_SEGMENT: link the persisted opening annotation to its host
        // wall (anchor = host segment point ids + fixed distance in meters
        // from the reference vertex). Free placements (no host) skip this.
        if (isOpeningSegmentCommit && openingHostId && openingAnchor && _newAnnotation?.id) {
            await addAnnotationOpening({
                projectId,
                hostAnnotationId: openingHostId,
                openingAnnotationId: _newAnnotation.id,
                ...openingAnchor,
                carve: openingCarve ?? { mode: "NONE" },
            });
        }

        // REVOLUTION_POINT placed from the elevation panel ("Positionner l'axe
        // sur la vue en plan"): the point carries the revolution axis id, so we
        // project every arc linked to that axis onto the plan as a "donut" proxy
        // polygon centred on the click. See createRevolutionProxiesOnPlan.
        if (
            _newAnnotation?.type === "REVOLUTION_POINT" &&
            _newAnnotation?.revolutionAxisId &&
            baseMap &&
            rawPoints?.[0]
        ) {
            try {
                await createRevolutionProxiesOnPlan({
                    axisId: _newAnnotation.revolutionAxisId,
                    centerPx: { x: rawPoints[0].x, y: rawPoints[0].y },
                    planBaseMap: baseMap,
                    projectId,
                    listingId,
                    createAnnotation,
                });
                dispatch(triggerAnnotationsUpdate());
            } catch (e) {
                console.error(
                    "[useHandleCommitDrawing] revolution proxy creation failed",
                    e
                );
            }
        }


        // Auto-merge : on commit of a POLYGON drawn via the RECTANGLE, the
        // point-by-point CLICK, or the CIRCLE tools, try to absorb overlapping
        // same-template polygons on the same baseMap / listing. The newly-
        // committed polygon stays as the winner. The merge service preserves
        // S-C-S arcs, so a circle keeps its rounding through the union.
        const shouldAutoMerge = (
            autoMergeOnCommit &&
            ["POLYGON_RECTANGLE", "POLYGON_CLICK", "POLYGON_CIRCLE", "POLYGON_CIRCLE_RADIUS"].includes(enabledDrawingMode) &&
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