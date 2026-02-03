
import { useLiveQuery } from "dexie-react-hooks";

import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageTextAnnotations from "Features/bgImage/hooks/useBgImageTextAnnotations";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getAnnotationPropsFromAnnotationTemplateProps from "Features/annotations/utils/getAnnotationPropsFromAnnotationTemplateProps";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

export default function useAnnotationsV2(options) {

    try {
        // options


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

        // data

        const appConfig = useAppConfig();


        const projectId = useSelector(s => s.projects.selectedProjectId);
        const selectedListingId = useSelector(s => s.listings.selectedListingId);
        const { value: scope } = useSelectedScope();
        const baseMap = useMainBaseMap();

        const annotationTemplates = useAnnotationTemplates();
        const annotationTemplatesMap = getItemsByKey(annotationTemplates, "id");

        const tempAnnotations = useSelector((s) => s.annotations.tempAnnotations);

        const bgImageTextAnnotations = useBgImageTextAnnotations();

        const annotationsUpdatedAt = useSelector(
            (s) => s.annotations.annotationsUpdatedAt
        );

        const { value: baseMaps, baseMapsUpdatedAt } = useBaseMaps();
        const baseMapById = getItemsByKey(baseMaps, "id");

        // helper - selected items

        const baseMapId = (filterByMainBaseMap || baseMapAnnotationsOnly) ? baseMap?.id : filterByBaseMapId;
        const listingId = filterBySelectedListing ? selectedListingId : filterByListingId;


        // main
        let annotations = useLiveQuery(async () => {

            // edge case
            if (!baseMaps || !projectId) return null;
            // annotations

            let _annotations;
            let points;
            if (baseMapId) {
                _annotations = await db.annotations.where("baseMapId").equals(baseMapId).toArray();
                points = await db.points.where("baseMapId").equals(baseMapId).toArray();
            }

            if (listingId) {
                if (!_annotations) {
                    _annotations = await db.annotations.where("listingId").equals(listingId).toArray();
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
                _annotations = await db.annotations.where("projectId").equals(projectId).toArray();
                points = await db.points.where("projectId").equals(projectId).toArray();
            }

            // base map annotations

            if (baseMapAnnotationsOnly) {
                _annotations = _annotations.filter(a => a.isBaseMapAnnotation)
            }

            if (hideBaseMapAnnotations) {
                _annotations = _annotations.filter(a => !a.isBaseMapAnnotation)
            }


            // filter by scope

            if (scope?.sortedListings) {
                const listingIds = scope.sortedListings.map(l => l.id)
                _annotations = _annotations.filter(a => listingIds.includes(a.listingId) || a.isBaseMapAnnotation)
            }

            // add images (for annotation type = "IMAGE")

            if (_annotations) {
                _annotations = await Promise.all(
                    _annotations.map(async (annotation) => {
                        const { entityWithImages } = await getEntityWithImagesAsync(annotation);
                        return {
                            ...entityWithImages,
                            //imageUrlClient: annotation.image.imageUrlClient,
                        };
                    })
                );
            }

            // points

            const pointsIndex = getItemsByKey(points, "id");
            _annotations = _annotations.filter(a => a.baseMapId).map(annotation => {
                const _annotation = {
                    ...annotation,
                }

                let annotationPoints = annotation?.points;


                const baseMap = baseMapById[annotation.baseMapId];
                const imageSize = baseMap?.image?.imageSize;
                // const scale = (baseMap?.image?.imageSize && baseMap?.imageEnhanced?.imageSize && baseMap?.showEnhanced) ?
                //     baseMap.imageEnhanced.imageSize.width / baseMap.image.imageSize.width :
                //     1;

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
                else if (annotation.type === "IMAGE" || annotation.type === "RECTANGLE") {
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

                }

                // --- QTIES ---

                if (withQties) {
                    _annotation.qties = getAnnotationQties({ annotation: _annotation, meterByPx });
                }

                return _annotation;


            })

            // -- LISTINGS --

            const listingsIds = _annotations.reduce(
                (ac, cur) => [...new Set([...ac, cur.listingId])],
                []
            );
            const listings = await db.listings
                .where("id")
                .anyOf(listingsIds.filter(Boolean))
                .toArray();

            // Create a map for quick lookup
            const listingsMap = getItemsByKey(listings, "id");

            // -- LISTING NAME --

            if (withListingName) {
                // Add listing name to annotations
                _annotations = _annotations.map((annotation) => ({
                    ...annotation,
                    listingName: listingsMap[annotation?.listingId]?.name || "-?-",
                }));
            }

            if (excludeListingsIds && !baseMapAnnotationsOnly) {
                _annotations = _annotations?.filter(
                    (a) => !excludeListingsIds.includes(a.listingId)
                );
            }

            if (baseMapAnnotationsOnly) {
                _annotations = _annotations?.filter(
                    (a) => a.isBaseMapAnnotation
                );
            }


            // -- SORT --

            const annotationById = getItemsByKey(_annotations, "id");

            const sortedAnnotationIds = [];
            listings.forEach((listing) => {
                if (listing.sortedAnnotationIds) {
                    sortedAnnotationIds.push(...listing.sortedAnnotationIds);
                } else {
                    sortedAnnotationIds.push(
                        ..._annotations
                            .filter((a) => a.listingId === listing.id || a.isBaseMapAnnotation)
                            .map((a) => a.id)
                    );
                }
            });

            _annotations = sortedAnnotationIds.map((id) => annotationById[id]);


            // -- ENTITY --

            if (withEntity) {
                _annotations = await Promise.all(
                    _annotations.map(async (annotation) => {
                        let table = annotation?.listingTable;
                        if (!table) table = listingsMap?.[annotation?.listingId]?.table;
                        if (table && annotation.entityId) {
                            const entity = await db[table].get(annotation.entityId);
                            const { entityWithImages, hasImages } =
                                await getEntityWithImagesAsync(entity);
                            const listing = listingsMap[annotation?.listingId];
                            const em = appConfig?.entityModelsObject?.[listing.entityModelKey];
                            const labelKey = em?.labelKey || "label";
                            const label = entity[labelKey];
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

            return _annotations;


        }, [
            scope?.id,
            baseMap?.id,
            projectId,
            listingId,
            baseMapId,
            excludeListingsIds?.join("-"),
            baseMapAnnotationsOnly,
            hideBaseMapAnnotations,
            annotationsUpdatedAt,
            baseMapsUpdatedAt,
            baseMaps?.length,
        ]);

        if (filterByMainBaseMap) console.log("_annotations", annotations)


        // override with annotation templates
        annotations = annotations?.map(annotation => {
            if (annotation?.isBaseMapAnnotation) {
                return annotation;
            } else {
                const baseMap = baseMapById[annotation?.baseMapId];
                const templateProps = getAnnotationTemplateProps(annotationTemplatesMap[annotation?.annotationTemplateId])
                return getAnnotationPropsFromAnnotationTemplateProps(annotation, templateProps, baseMap)

                // return {
                //     ...annotation,
                //     ...templateProps,
                //     label: annotation?.label ?? templateProps?.label,
                //     templateLabel: templateProps?.label,
                // }
            }

        })

        if (groupByBaseMap && annotations) {

            const baseMapIds = [...new Set(annotations.filter(a => Boolean(a.baseMapId)).map(a => a.baseMapId))];
            const baseMaps = baseMapIds.map(id => baseMapById[id]);
            console.log("debug_2201_baseMaps", baseMaps, baseMapIds)
            annotations = annotations.map(a => ({ ...a, baseMap: baseMapById[a.baseMapId] }));
            annotations = [...annotations, ...baseMaps.map(b => ({ id: b.id, baseMap: b, isBaseMap: true }))]
            annotations.sort((a, b) => (a.isBaseMap ? 1 : 2) - (b.isBaseMap ? 1 : 2)).sort((a, b) => a.baseMap?.name.localeCompare(b.baseMap?.name));
        }


        // override with temp annotations
        annotations = [...(annotations ?? []), ...(tempAnnotations ?? [])];

        // bg image text annotations
        if (!baseMapAnnotationsOnly && !excludeBgAnnotations) annotations = [...(annotations ?? []), ...(bgImageTextAnnotations ?? [])];


        // return 

        return annotations;
    } catch (e) {
        console.log(e);
        return [];
    }
}