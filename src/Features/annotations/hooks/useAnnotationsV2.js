
import { useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { useSelector } from "react-redux";

// Module-level cache for listings (shared across all useAnnotationsV2 instances)
const _listingsCache = { key: null, listings: null, listingsMap: null, forBaseMapsListingIds: null };
// Invalidate cache when listings table changes
db.listings.hook("creating", () => { _listingsCache.key = null; });
db.listings.hook("updating", () => { _listingsCache.key = null; });
db.listings.hook("deleting", () => { _listingsCache.key = null; });

// Module-level incremental cache for entities (keyed by table)
// Maps: table -> { idSet: Set<id>, cache: Map<id, entity> }
const _entitiesCache = {};
// Invalidate entity cache per table on updates/deletes
const _hookEntityTable = (tableName) => {
    if (!db[tableName]) return;
    try {
        db[tableName].hook("updating", (mods, primKey) => {
            if (_entitiesCache[tableName]) _entitiesCache[tableName].cache.delete(primKey);
        });
        db[tableName].hook("deleting", (primKey) => {
            if (_entitiesCache[tableName]) _entitiesCache[tableName].cache.delete(primKey);
        });
    } catch { /* hook already registered */ }
};
const _hookedEntityTables = new Set();

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageTextAnnotations from "Features/bgImage/hooks/useBgImageTextAnnotations";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import resolveGuideLine from "Features/annotations/utils/resolveGuideLine";
import applyGuideLineRampToRings from "Features/annotations/utils/applyGuideLineRampToRings";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getAnnotationPropsFromAnnotationTemplateProps from "Features/annotations/utils/getAnnotationPropsFromAnnotationTemplateProps";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import getAnnotationSubtractionQties from "Features/annotations/utils/getAnnotationSubtractionQties";
import getExtrusionProfileFootprintShapes from "Features/annotations/utils/getExtrusionProfileFootprintShapes";
import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";
import { resolveProfileFromDb } from "Features/annotations/hooks/useProfileResolution";
import computeSubtractedSurfaceM2Async from "Features/threedEditor/js/utilsAnnotationsManager/computeSubtractedSurfaceM2Async";

export default function useAnnotationsV2(options) {

    try {
        // options

        const _caller = options?.caller || "unknown";
        const enabled = options?.enabled ?? true;

        const filterByBaseMapId = options?.filterByBaseMapId;
        const filterByListingId = options?.filterByListingId;


        const filterBySelectedScope = options?.filterBySelectedScope;
        const filterByMainBaseMap = options?.filterByMainBaseMap;
        const filterBySelectedListing = options?.filterBySelectedListing;

        const excludeListingsIds = options?.excludeListingsIds;
        const excludeBgAnnotations = options?.excludeBgAnnotations;

        const withEntity = options?.withEntity;
        const withListingName = options?.withListingName;
        const withQties = options?.withQties;

        const baseMapAnnotationsOnly = options?.baseMapAnnotationsOnly;
        const hideBaseMapAnnotations = options?.hideBaseMapAnnotations;

        const groupByBaseMap = options?.groupByBaseMap;
        const sortByOrderIndex = options?.sortByOrderIndex;
        const excludeIsForBaseMapsListings = options?.excludeIsForBaseMapsListings;
        const onlyIsForBaseMapsListings = options?.onlyIsForBaseMapsListings;

        // data

        const appConfig = useAppConfig();


        const projectId = useSelector(s => s.projects.selectedProjectId);
        const selectedListingId = useSelector(s => s.listings.selectedListingId);
        const { value: scope } = useSelectedScope();
        const baseMap = useMainBaseMap();

        const annotationTemplates = useAnnotationTemplates();
        const annotationTemplatesMap = useMemo(
            () => getItemsByKey(annotationTemplates, "id"),
            [annotationTemplates]
        );

        const tempAnnotations = useSelector((s) => s.annotations.tempAnnotations);

        const bgImageTextAnnotations = useBgImageTextAnnotations();

        const annotationsUpdatedAt = useSelector(
            (s) => s.annotations.annotationsUpdatedAt
        );

        const hiddenLayerIds = useSelector(s => s.layers?.hiddenLayerIds || []);
        const showAnnotationsWithoutLayer = useSelector(s => s.layers?.showAnnotationsWithoutLayer ?? true);
        const layersUpdatedAt = useSelector(s => s.layers?.layersUpdatedAt);

        const listingsUpdatedAt = useSelector(s => s.listings.listingsUpdatedAt);

        const soloMode = useSelector(s => s.popperMapListings.soloMode);
        const soloVisibleTemplateIds = useSelector(s => s.popperMapListings.soloVisibleTemplateIds);
        const soloListingId = useSelector(s => s.popperMapListings.soloListingId);

        const { targetIdsBySource: subtractionTargetIdsBySource } =
            useAnnotationSubtractions();

        const { value: baseMaps, baseMapsUpdatedAt } = useBaseMaps();
        const baseMapById = useMemo(
            () => getItemsByKey(baseMaps, "id"),
            [baseMaps]
        );

        // helper - selected items

        const baseMapId = (filterByMainBaseMap || baseMapAnnotationsOnly) ? baseMap?.id : filterByBaseMapId;
        const listingId = filterBySelectedListing ? selectedListingId : filterByListingId;


        // main
        let annotations = useLiveQuery(async () => {

            // skip computation when disabled
            if (!enabled) return [];

            // edge case
            if (!baseMaps || !projectId) return null;

            const _t0 = performance.now();
            // annotations

            let _annotations;
            let points;
            if (baseMapId) {
                _annotations = (await db.annotations.where("baseMapId").equals(baseMapId).toArray()).filter(r => !r.deletedAt);
                points = (await db.points.where("baseMapId").equals(baseMapId).toArray()).filter(r => !r.deletedAt);
            }

            if (listingId) {
                if (!_annotations) {
                    _annotations = (await db.annotations.where("listingId").equals(listingId).toArray()).filter(r => !r.deletedAt);
                } else {

                    _annotations = _annotations.filter(a => a.listingId === listingId);
                }
                if (!points) {
                    points = await db.points.where("projectId").equals(projectId).toArray();
                }

                // remove base map annotations
                _annotations = _annotations.filter(a => !a.isBaseMapAnnotation)

            }

            if (!listingId && !baseMapId) {
                _annotations = (await db.annotations.where("projectId").equals(projectId).toArray()).filter(r => !r.deletedAt);
                points = (await db.points.where("projectId").equals(projectId).toArray()).filter(r => !r.deletedAt);
            }

            const _t1 = performance.now();
            // base map annotations

            if (baseMapAnnotationsOnly) {
                _annotations = _annotations.filter(a => a.isBaseMapAnnotation)
            }

            if (hideBaseMapAnnotations) {
                _annotations = _annotations.filter(a => !a.isBaseMapAnnotation)
            }

            // layer visibility filter
            if (hiddenLayerIds.length > 0 || !showAnnotationsWithoutLayer) {
                _annotations = _annotations.filter(a => {
                    if (a.isBaseMapAnnotation) return true;
                    if (!a.layerId) return showAnnotationsWithoutLayer;
                    return !hiddenLayerIds.includes(a.layerId);
                });
            }

            const _t2 = performance.now();
            // -- LISTINGS (with module-level cache) --

            const listingsIds = [...new Set(_annotations.map(a => a.listingId).filter(Boolean))];
            const _t2a = performance.now();
            const listingsCacheKey = listingsIds.sort().join(",");
            let listings, listingsMap, forBaseMapsListingIds;
            if (_listingsCache.key === listingsCacheKey) {
                // Cache hit — skip DB query
                listings = _listingsCache.listings;
                listingsMap = _listingsCache.listingsMap;
                forBaseMapsListingIds = _listingsCache.forBaseMapsListingIds;
            } else {
                // Cache miss — fetch from DB and update cache
                listings = await db.listings
                    .where("id")
                    .anyOf(listingsIds)
                    .toArray();
                listingsMap = getItemsByKey(listings, "id");
                forBaseMapsListingIds = new Set(
                    listings.filter((l) => l.isForBaseMaps).map((l) => l.id)
                );
                _listingsCache.key = listingsCacheKey;
                _listingsCache.listings = listings;
                _listingsCache.listingsMap = listingsMap;
                _listingsCache.forBaseMapsListingIds = forBaseMapsListingIds;
            }
            const _t2b = performance.now();

            if (excludeIsForBaseMapsListings) {
                _annotations = _annotations.filter(
                    (a) => !forBaseMapsListingIds.has(a.listingId)
                );
            }

            if (onlyIsForBaseMapsListings) {
                _annotations = _annotations.filter(
                    (a) => forBaseMapsListingIds.has(a.listingId)
                );
            }

            // -- SCOPE FILTER --

            if (filterBySelectedScope && scope?.id) {
                const scopeListingIds = new Set(
                    listings
                        .filter((l) => {
                            const em = appConfig?.entityModelsObject?.[l.entityModelKey];
                            return em?.type === "BASE_MAP" || l.scopeId === scope?.id;
                        })
                        .map((l) => l.id)
                );
                _annotations = _annotations.filter(
                    (a) => a.isBaseMapAnnotation || scopeListingIds.has(a.listingId)
                );
            }

            // -- LISTING EXCLUSIONS --

            if (excludeListingsIds && !baseMapAnnotationsOnly) {
                _annotations = _annotations.filter(
                    (a) => !excludeListingsIds.includes(a.listingId)
                );
            }

            if (baseMapAnnotationsOnly) {
                _annotations = _annotations.filter(
                    (a) => a.isBaseMapAnnotation
                );
            }

            // layer sort order — first layer's annotations drawn on top (last in array)
            const _t2c = performance.now();
            if (baseMapId) {
                const layers = (await db.layers.where("baseMapId").equals(baseMapId).toArray())
                    .filter(l => !l.deletedAt)
                    .sort((a, b) => {
                        const ai = a.orderIndex ?? "";
                        const bi = b.orderIndex ?? "";
                        return ai < bi ? -1 : ai > bi ? 1 : 0;
                    });
                if (layers.length > 0) {
                    const layerOrder = {};
                    layers.forEach((l, i) => { layerOrder[l.id] = i; });
                    const maxOrder = layers.length;
                    _annotations = _annotations.sort((a, b) => {
                        if (a.isBaseMapAnnotation !== b.isBaseMapAnnotation) {
                            return a.isBaseMapAnnotation ? -1 : 1;
                        }
                        const orderA = a.layerId ? (layerOrder[a.layerId] ?? maxOrder) : maxOrder + 1;
                        const orderB = b.layerId ? (layerOrder[b.layerId] ?? maxOrder) : maxOrder + 1;
                        // first layer (index 0) = bottom = first in array
                        return orderA - orderB;
                    });
                }
            }

            const _t3 = performance.now();
            // add images (only for IMAGE and MARKER annotations) — batched
            if (_annotations) {
                const imageAnnotations = _annotations.filter(a => a.type === "IMAGE" || a.type === "MARKER");
                if (imageAnnotations.length > 0) {
                    // Collect all fileNames needed
                    const fileNames = new Set();
                    for (const a of imageAnnotations) {
                        if (Array.isArray(a.images)) a.images.forEach(img => { if (img?.fileName) fileNames.add(img.fileName); });
                        for (const [key, val] of Object.entries(a)) {
                            if (key !== "images" && val && typeof val === "object" && val.isImage && val.fileName) fileNames.add(val.fileName);
                        }
                    }
                    // Batch fetch all files at once
                    const filesArray = fileNames.size > 0 ? await db.files.where("fileName").anyOf([...fileNames]).toArray() : [];
                    const filesMap = {};
                    for (const f of filesArray) { filesMap[f.fileName] = f; }

                    _annotations = await Promise.all(
                        _annotations.map(async (annotation) => {
                            if (annotation.type !== "IMAGE" && annotation.type !== "MARKER") return annotation;
                            const { entityWithImages } = await getEntityWithImagesAsync(annotation, filesMap);
                            return { ...entityWithImages };
                        })
                    );
                }
            }

            const _t4 = performance.now();
            // points

            const pointsIndex = getItemsByKey(points, "id");
            _annotations = _annotations.filter(a => a.baseMapId).map(annotation => {
                const _annotation = {
                    ...annotation,
                }

                let annotationPoints = annotation?.points;


                const baseMap = baseMapById[annotation.baseMapId];
                const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;

                if (!imageSize) return [];
                const { width, height } = imageSize;
                const meterByPx = baseMap.getMeterByPx();

                //if (annotation.isBaseMapAnnotation) console.log("debug_width", width?.toFixed(2))


                _annotation.baseMapName = baseMap?.name;

                // legacy conversion

                const isMarkerLegacy = testObjectHasProp(annotation, "x") || testObjectHasProp(annotation, "y");
                if (isMarkerLegacy) {
                    annotationPoints = [{ x: annotation.x, y: annotation.y }];
                }

                // markers, labels, ....

                if (_annotation.type === "MARKER") {
                    _annotation.point = resolvePoints({ points: [annotation.point], pointsIndex, imageSize })[0];
                }

                // --- POINT

                else if (_annotation.type === "POINT") {
                    _annotation.point = resolvePoints({ points: [annotation.point], pointsIndex, imageSize })[0];
                }

                // --- LABELS
                else if (_annotation.type === "LABEL") {
                    _annotation.targetPoint = {
                        x: annotation.targetPoint.x * width,
                        y: annotation.targetPoint.y * height
                    }
                    _annotation.labelPoint = {
                        x: annotation.labelPoint.x * width,
                        y: annotation.labelPoint.y * height
                    }
                }

                // --- IMAGE
                else if (annotation.type === "IMAGE" || annotation.type === "RECTANGLE" || annotation.type === "OBJECT_3D") {
                    _annotation.bbox = {
                        x: (annotation.bbox?.x ?? 0.25) * width,
                        y: (annotation.bbox?.y ?? 0.25) * height,
                        width: (annotation.bbox?.width ?? 0.5) * width,
                        height: (annotation.bbox?.height ?? 0.5) * height,
                    }
                }

                // --- OTHER CASES
                else {
                    _annotation.points = resolvePoints({ points: annotationPoints, pointsIndex, imageSize });
                    if (_annotation.cuts) _annotation.cuts = resolveCuts({ cuts: annotation.cuts, pointsIndex, imageSize });
                    // Inner Steiner points (POLYGON only) — resolve to pixel space so
                    // the rendering and 3D pipelines see them in the same units as the
                    // contour and cuts.
                    if (annotation.innerPoints) {
                        _annotation.innerPoints = resolvePoints({ points: annotation.innerPoints, pointsIndex, imageSize });
                    }
                    if (Array.isArray(annotation.guideLines)) {
                        _annotation.guideLines = annotation.guideLines.map((g) => ({
                            ...g,
                            points: resolveGuideLine({ guideLine: g?.points, pointsIndex, imageSize }),
                        }));
                    }

                    // guideLines ramp: derive each vertex's offsetTop from its
                    // projection onto the nearest guideLine (height accumulates
                    // along the ordered lines) so the sloped surface is a pure
                    // function of position (iso-lines normal to the guideLines)
                    // and stays correct when the contour is edited.
                    if (
                        _annotation.guideLines?.some(
                            (g) => g?.points?.length >= 2 && g?.slopePct
                        )
                    ) {
                        const ramped = applyGuideLineRampToRings({
                            points: _annotation.points,
                            cuts: _annotation.cuts,
                            innerPoints: _annotation.innerPoints,
                            guideLines: _annotation.guideLines,
                            meterByPx,
                        });
                        _annotation.points = ramped.points;
                        _annotation.cuts = ramped.cuts;
                        _annotation.innerPoints = ramped.innerPoints;
                    }

                }

                // --- ROTATION CENTER (resolve to pixels) ---

                if (_annotation.rotationCenter) {
                    _annotation.rotationCenter = {
                        x: _annotation.rotationCenter.x * width,
                        y: _annotation.rotationCenter.y * height,
                    };
                }

                // --- QTIES ---

                if (withQties) {
                    _annotation.qties = getAnnotationQties({ annotation: _annotation, meterByPx });
                }

                return _annotation;


            })

            // -- LISTING NAME + TAG isForBaseMaps (single pass) --

            _annotations = _annotations.map((a) => ({
                ...a,
                ...(withListingName && { listingName: listingsMap[a?.listingId]?.name || "-?-" }),
                isForBaseMaps: forBaseMapsListingIds.has(a.listingId),
            }));

            // -- SORT --
            // outdated : use fractional indexing insteaad.

            //const annotationById = getItemsByKey(_annotations, "id");

            // const sortedAnnotationIds = [];
            // listings.forEach((listing) => {
            //     if (listing.sortedAnnotationIds) {
            //         sortedAnnotationIds.push(...listing.sortedAnnotationIds);
            //     } else {
            //         sortedAnnotationIds.push(
            //             ..._annotations
            //                 .filter((a) => a.listingId === listing.id || a.isBaseMapAnnotation)
            //                 .map((a) => a.id)
            //         );
            //     }
            // });

            // _annotations = sortedAnnotationIds.map((id) => annotationById[id]);


            const _t5 = performance.now();
            // -- ENTITY (batched) --

            if (withEntity) {
                // Group annotations by table for batch fetching
                const _te0 = performance.now();
                const byTable = {};
                for (const annotation of _annotations) {
                    let table = annotation?.listingTable;
                    if (!table) table = listingsMap?.[annotation?.listingId]?.table;
                    if (table && annotation.entityId) {
                        if (!byTable[table]) byTable[table] = new Set();
                        byTable[table].add(annotation.entityId);
                    }
                }

                // Incremental batch fetch: only fetch IDs not already in cache
                const entityCache = {};
                let _fetchedCount = 0;
                for (const [table, ids] of Object.entries(byTable)) {
                    // Ensure hooks are registered for this table
                    if (!_hookedEntityTables.has(table)) {
                        _hookEntityTable(table);
                        _hookedEntityTables.add(table);
                    }
                    // Init table cache if needed
                    if (!_entitiesCache[table]) {
                        _entitiesCache[table] = { cache: new Map() };
                    }
                    const tableCache = _entitiesCache[table].cache;

                    // Find IDs not in cache
                    const missingIds = [];
                    for (const id of ids) {
                        if (tableCache.has(id)) {
                            entityCache[id] = tableCache.get(id);
                        } else {
                            missingIds.push(id);
                        }
                    }

                    // Fetch only missing IDs
                    if (missingIds.length > 0) {
                        const fetched = await db[table].where("id").anyOf(missingIds).toArray();
                        _fetchedCount += fetched.length;
                        for (const e of fetched) {
                            tableCache.set(e.id, e);
                            entityCache[e.id] = e;
                        }
                    }
                }
                const _te1 = performance.now();

                // Batch fetch all files needed by entities
                const entityFileNames = new Set();
                for (const entity of Object.values(entityCache)) {
                    if (Array.isArray(entity.images)) entity.images.forEach(img => { if (img?.fileName) entityFileNames.add(img.fileName); });
                    for (const [key, val] of Object.entries(entity)) {
                        if (key !== "images" && val && typeof val === "object" && val.isImage && val.fileName) entityFileNames.add(val.fileName);
                    }
                }
                const entityFilesArray = entityFileNames.size > 0 ? await db.files.where("fileName").anyOf([...entityFileNames]).toArray() : [];
                const entityFilesMap = {};
                for (const f of entityFilesArray) { entityFilesMap[f.fileName] = f; }
                const _te2 = performance.now();

                console.log(`[debug_perf]   entities detail: db.entities=${(_te1-_te0).toFixed(1)}ms (${Object.keys(entityCache).length} entities, ${_fetchedCount} fetched) | db.files=${(_te2-_te1).toFixed(1)}ms (${entityFilesArray.length} files)`);

                // Enrich annotations with entities
                _annotations = await Promise.all(
                    _annotations.map(async (annotation) => {
                        let table = annotation?.listingTable;
                        if (!table) table = listingsMap?.[annotation?.listingId]?.table;
                        if (table && annotation.entityId) {
                            const entity = entityCache[annotation.entityId];
                            const { entityWithImages, hasImages } =
                                await getEntityWithImagesAsync(entity, entityFilesMap);
                            const listing = listingsMap[annotation?.listingId];
                            const em = appConfig?.entityModelsObject?.[listing.entityModelKey];
                            const labelKey = em?.labelKey || "label";
                            let label = entity?.[labelKey];
                            const pad = em?.labelOptions?.zeroPadStart;
                            const prefix = em?.labelOptions?.prefix;
                            if (pad && label != null) label = label.toString().padStart(pad, '0')
                            if (prefix && label != null) label = `${prefix}${label}`
                            return {
                                ...annotation,
                                entity: entityWithImages, hasImages,
                                label,
                            };
                        } else {
                            return annotation;
                        }
                    })
                );
            }

            const _t6 = performance.now();
            console.log(
                `[debug_perf] useAnnotationsV2 [${_caller}] (${_annotations?.length ?? 0} annotations):\n` +
                `  DB fetch:       ${(_t1 - _t0).toFixed(1)}ms (${listingsIds.length} listingIds)\n` +
                `  filters:        ${(_t2 - _t1).toFixed(1)}ms\n` +
                `  listings total: ${(_t3 - _t2).toFixed(1)}ms  [db.listings: ${(_t2b - _t2a).toFixed(1)}ms (${listings.length} found) | filters+scope: ${(_t2c - _t2b).toFixed(1)}ms | db.layers+sort: ${(_t3 - _t2c).toFixed(1)}ms]\n` +
                `  images batch:   ${(_t4 - _t3).toFixed(1)}ms\n` +
                `  points/qties:   ${(_t5 - _t4).toFixed(1)}ms\n` +
                `  entities:       ${(_t6 - _t5).toFixed(1)}ms\n` +
                `  TOTAL:          ${(_t6 - _t0).toFixed(1)}ms`
            );

            // -- EXTRUSION_PROFILE SUBTRACTION FOOTPRINTS --
            // For profile annotations used as subtraction targets, precompute
            // their exact planar footprint (the swept prisms' XY projection) so
            // the synchronous surface-quantity path can subtract it precisely.
            // Gated to actual targets to avoid resolving profiles otherwise.
            if (subtractionTargetIdsBySource?.size > 0 && _annotations?.length) {
                const targetIdSet = new Set();
                for (const ids of subtractionTargetIdsBySource.values()) {
                    for (const id of ids) targetIdSet.add(id);
                }
                if (targetIdSet.size > 0) {
                    const profileResCache = new Map();
                    for (const a of _annotations) {
                        if (!a || !targetIdSet.has(a.id)) continue;
                        if (getShape3DKey(a.shape3D) !== "EXTRUSION_PROFILE") continue;
                        const tplId = a.shape3D?.profileTemplateId;
                        if (!tplId) continue;
                        let res = profileResCache.get(tplId);
                        if (res === undefined) {
                            res = await resolveProfileFromDb(tplId);
                            profileResCache.set(tplId, res);
                        }
                        const bm = baseMapById[a.baseMapId];
                        const shapes = getExtrusionProfileFootprintShapes(
                            a,
                            bm?.getMeterByPx?.(),
                            res
                        );
                        if (shapes) a._profileFootprintShapes = shapes;
                    }
                }
            }

            // -- EXTRUSION_PROFILE SUBTRACTION SOURCES (developed surface) --
            // For EXTRUSION_PROFILE hosts that subtract other annotations, the
            // carved quantity is a developed surface (not a footprint). Resolve
            // the profile length (so the base surface is computed) and run the
            // same headless 3D carve to get the removed m². Both are stored and
            // applied to qties in the post-processing pass. Gated to withQties.
            if (withQties && subtractionTargetIdsBySource?.size > 0 && _annotations?.length) {
                const profileLenCache = new Map();
                for (const a of _annotations) {
                    const targetIds = subtractionTargetIdsBySource.get(a?.id);
                    if (!targetIds || targetIds.length === 0) continue;
                    if (getShape3DKey(a.shape3D) !== "EXTRUSION_PROFILE") continue;
                    const targets = targetIds
                        .map((id) => _annotations.find((x) => x?.id === id))
                        .filter(Boolean);
                    if (targets.length === 0) continue;
                    const bm = baseMapById[a.baseMapId];
                    const imageSize = bm?.getImageSize?.() || bm?.image?.imageSize;
                    const meterByPx = bm?.getMeterByPx?.();
                    if (!imageSize?.width || !meterByPx) continue;
                    const baseMapForRender = {
                        imageWidth: imageSize.width,
                        imageHeight: imageSize.height,
                        meterByPx,
                    };
                    const tplId = a.shape3D?.profileTemplateId;
                    if (tplId) {
                        let plm = profileLenCache.get(tplId);
                        if (plm === undefined) {
                            const res = await resolveProfileFromDb(tplId);
                            plm = res?.profileLengthMeters ?? null;
                            profileLenCache.set(tplId, plm);
                        }
                        if (plm != null) a._profileLengthMeters = plm;
                    }
                    try {
                        const removed = await computeSubtractedSurfaceM2Async(
                            a,
                            baseMapForRender,
                            targets
                        );
                        if (removed != null) a._subtractedSurfaceM2 = removed;
                    } catch (e) {
                        console.error("[useAnnotationsV2] profile subtraction qty failed", e);
                    }
                }
            }

            return _annotations;


        }, [
            enabled,
            scope?.id,
            baseMap?.id,
            projectId,
            listingId,
            baseMapId,
            excludeListingsIds?.join("-"),
            excludeIsForBaseMapsListings,
            onlyIsForBaseMapsListings,
            baseMapAnnotationsOnly,
            hideBaseMapAnnotations,
            annotationsUpdatedAt,
            baseMapsUpdatedAt,
            baseMaps?.length,
            withEntity,
            hiddenLayerIds,
            showAnnotationsWithoutLayer,
            layersUpdatedAt,
            subtractionTargetIdsBySource,
        ]);



        // memoize post-processing to avoid recomputing on unrelated re-renders
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const processed = useMemo(() => {
            // skip post-processing when disabled
            if (!enabled || !annotations || annotations.length === 0) return [];

            // override with annotation templates
            let result = annotations.map(annotation => {
                if (annotation?.isBaseMapAnnotation) {
                    return annotation;
                } else {
                    const baseMap = baseMapById[annotation?.baseMapId];
                    const templateProps = getAnnotationTemplateProps(annotationTemplatesMap[annotation?.annotationTemplateId])
                    return getAnnotationPropsFromAnnotationTemplateProps(annotation, templateProps, baseMap)
                }
            });

            // recompute qties after template overrides so overridden height is reflected
            if (withQties) {
                result = result.map(annotation => {
                    if (annotation?.isBaseMapAnnotation) return annotation;
                    const baseMap = baseMapById[annotation?.baseMapId];
                    const meterByPx = baseMap?.getMeterByPx?.();
                    if (meterByPx) {
                        annotation.qties = getAnnotationQties({
                            annotation,
                            meterByPx,
                            // resolved in the async query for EXTRUSION_PROFILE
                            // subtraction hosts so the base surface is non-zero.
                            profileLengthMeters: annotation._profileLengthMeters,
                        });
                    }
                    return annotation;
                });
            }

            // -- SUBTRACTIONS --
            // Attach subtraction relations (targetIds + resolved target
            // annotations) so the 3D pipeline can carve the source mesh and the
            // surface quantity reflects the boolean difference.
            if (subtractionTargetIdsBySource?.size > 0) {
                const resultById = getItemsByKey(result, "id");
                result = result.map((a) => {
                    const targetIds = subtractionTargetIdsBySource.get(a?.id);
                    if (!targetIds || targetIds.length === 0) return a;
                    const subtractionTargets = targetIds
                        .map((id) => resultById[id])
                        .filter(Boolean);
                    const withSub = {
                        ...a,
                        subtractionTargetIds: targetIds,
                        subtractionTargets,
                    };
                    // Planar-footprint subtraction is only meaningful for
                    // slab-type sources (footprint = surface). For POLYLINE
                    // surfaces the carved area is a developed/lateral surface,
                    // not a footprint, so it is left to a dedicated path.
                    const isFootprintSurfaceType = ["POLYGON", "RECTANGLE", "STRIP"].includes(a?.type);
                    if (withQties && subtractionTargets.length > 0 && isFootprintSurfaceType) {
                        const baseMap = baseMapById[a?.baseMapId];
                        const meterByPx = baseMap?.getMeterByPx?.();
                        const subQ = getAnnotationSubtractionQties({
                            annotation: a,
                            targets: subtractionTargets,
                            meterByPx,
                        });
                        if (subQ) withSub.qties = { ...(withSub.qties || {}), ...subQ };
                    }

                    // Open-surface (EXTRUSION_PROFILE) hosts: subtract the 3D
                    // developed surface removed by the boolean (precomputed in
                    // the async query as `_subtractedSurfaceM2`).
                    if (
                        withQties &&
                        subtractionTargets.length > 0 &&
                        getShape3DKey(a?.shape3D) === "EXTRUSION_PROFILE" &&
                        a?._subtractedSurfaceM2 > 0 &&
                        withSub.qties
                    ) {
                        const removed = a._subtractedSurfaceM2;
                        const q = { ...withSub.qties };
                        if (Number.isFinite(q.surface)) {
                            q.surface = Math.max(0, q.surface - removed);
                        }
                        if (Number.isFinite(q.surfaceDeveloped)) {
                            q.surfaceDeveloped = Math.max(0, q.surfaceDeveloped - removed);
                        }
                        withSub.qties = q;
                    }
                    return withSub;
                });
            }

            // filter out annotations whose template is hidden
            result = result.filter(a => !a.hidden);

            // solo mode: keep only annotations whose template is in the visible set
            if (soloMode && soloVisibleTemplateIds != null && soloListingId) {
                const soloSet = new Set(soloVisibleTemplateIds);
                result = result.filter(a =>
                    a.listingId !== soloListingId || soloSet.has(a.annotationTemplateId)
                );
            }

            // override with temp annotations
            result = [...result, ...(tempAnnotations ?? [])];

            // bg image text annotations
            if (!baseMapAnnotationsOnly && !excludeBgAnnotations) result = [...result, ...(bgImageTextAnnotations ?? [])];

            // sort by listing rank, then template order, with manual orderIndex as top priority
            if (sortByOrderIndex) {
                // listing order map (by rank)
                const listingOrderMap = new Map();
                if (_listingsCache.listings?.length) {
                    [..._listingsCache.listings]
                        .sort((a, b) => String(a.rank ?? "").localeCompare(String(b.rank ?? "")))
                        .forEach((l, i) => listingOrderMap.set(l.id, i));
                }

                // template order map (by orderIndex + groupLabel consolidation)
                const templateOrderMap = new Map();
                if (annotationTemplatesMap) {
                    const templates = Object.values(annotationTemplatesMap);
                    const sorted = [...templates].sort((a, b) => {
                        const aIdx = a.orderIndex ?? null;
                        const bIdx = b.orderIndex ?? null;
                        if (aIdx && bIdx) return aIdx < bIdx ? -1 : aIdx > bIdx ? 1 : 0;
                        if (aIdx && !bIdx) return -1;
                        if (!aIdx && bIdx) return 1;
                        return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
                    });
                    // consolidate groups by groupLabel
                    const consolidated = [];
                    const consumed = new Set();
                    const normalizeGroup = (g) => (g ?? "").trim().toUpperCase().replace(/\s+/g, "");
                    for (const t of sorted) {
                        if (consumed.has(t.id)) continue;
                        consumed.add(t.id);
                        consolidated.push(t);
                        const ng = normalizeGroup(t.groupLabel);
                        if (ng) {
                            for (const t2 of sorted) {
                                if (!consumed.has(t2.id) && normalizeGroup(t2.groupLabel) === ng) {
                                    consumed.add(t2.id);
                                    consolidated.push(t2);
                                }
                            }
                        }
                    }
                    consolidated.forEach((t, i) => templateOrderMap.set(t.id, i));
                }

                const maxListingOrder = listingOrderMap.size;
                const maxTemplateOrder = templateOrderMap.size;

                result = result.sort((a, b) => {
                    // base map annotations always below
                    if (a.isBaseMapAnnotation !== b.isBaseMapAnnotation) {
                        return a.isBaseMapAnnotation ? -1 : 1;
                    }

                    const aHasManual = a.orderIndex != null;
                    const bHasManual = b.orderIndex != null;

                    // manual orderIndex (useMoveAnnotation) = highest priority
                    if (aHasManual && bHasManual) {
                        return a.orderIndex < b.orderIndex ? -1 : a.orderIndex > b.orderIndex ? 1 : 0;
                    }
                    if (aHasManual) return 1;
                    if (bHasManual) return -1;

                    // listing rank order
                    const aListing = listingOrderMap.get(a.listingId) ?? maxListingOrder;
                    const bListing = listingOrderMap.get(b.listingId) ?? maxListingOrder;
                    if (aListing !== bListing) return aListing - bListing;

                    // template order within listing
                    const aTemplate = templateOrderMap.get(a.annotationTemplateId) ?? maxTemplateOrder;
                    const bTemplate = templateOrderMap.get(b.annotationTemplateId) ?? maxTemplateOrder;
                    return aTemplate - bTemplate;
                });
            }

            // group by base map
            if (groupByBaseMap) {
                const baseMapIds = [...new Set(result.filter(a => Boolean(a.baseMapId)).map(a => a.baseMapId))];
                const baseMaps = baseMapIds.map(id => baseMapById[id]);
                result = result.map(a => ({ ...a, baseMap: baseMapById[a.baseMapId] }));
                result = [...result, ...baseMaps.map(b => ({ id: b.id, baseMap: b, isBaseMap: true }))]
                result.sort((a, b) => (a.isBaseMap ? 1 : 2) - (b.isBaseMap ? 1 : 2)).sort((a, b) => a.baseMap?.name.localeCompare(b.baseMap?.name));
            }

            return result;
        }, [
            enabled,
            annotations,
            annotationTemplatesMap,
            baseMapById,
            withQties,
            soloMode, soloVisibleTemplateIds, soloListingId,
            tempAnnotations,
            bgImageTextAnnotations,
            baseMapAnnotationsOnly, excludeBgAnnotations,
            sortByOrderIndex,
            groupByBaseMap,
            listingsUpdatedAt,
            subtractionTargetIdsBySource,
        ]);

        return processed;
    } catch (e) {
        console.log(e);
        return [];
    }
}