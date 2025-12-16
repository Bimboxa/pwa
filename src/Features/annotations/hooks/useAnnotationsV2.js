
import { useLiveQuery } from "dexie-react-hooks";

import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageTextAnnotations from "Features/bgImage/hooks/useBgImageTextAnnotations";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolvePoints from "Features/annotations/utils/resolvePoints";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

export default function useAnnotationsV2(options) {

    try {
        // options

        const withEntity = options?.withEntity;
        const filterByBaseMapId = options?.filterByBaseMapId;
        const excludeListingsIds = options?.excludeListingsIds;
        const withListingName = options?.withListingName;

        // data

        const appConfig = useAppConfig();
        const baseMap = useMainBaseMap();

        const annotationTemplates = useAnnotationTemplates();
        const annotationTemplatesMap = getItemsByKey(annotationTemplates, "id");

        const tempAnnotations = useSelector((s) => s.annotations.tempAnnotations);

        const bgImageTextAnnotations = useBgImageTextAnnotations();


        // main
        let annotations = useLiveQuery(async () => {
            if (baseMap?.id) {

                // imageSize
                const imageSize = baseMap.image.imageSize;
                const { width, height } = imageSize;


                // points index
                const points = await db.points.where("baseMapId").equals(baseMap?.id).toArray();
                const pointsIndex = getItemsByKey(points, "id");

                // annotations
                let _annotations = await db.annotations.where("baseMapId").equals(baseMap?.id).toArray();

                console.log("_annotations", _annotations);

                _annotations = _annotations.map(annotation => {
                    const _annotation = {
                        ...annotation,
                    }

                    let annotationPoints = annotation?.points;


                    // legacy conversion

                    const isMarkerLegacy = testObjectHasProp(annotation, "x") || testObjectHasProp(annotation, "y");
                    if (isMarkerLegacy) {
                        annotationPoints = [{ x: annotation.x, y: annotation.y }];
                    }

                    // markers, labels, ....

                    if (_annotation.type === "MARKER") {
                        _annotation.point = resolvePoints({ points: annotationPoints, pointsIndex, imageSize: baseMap.image.imageSize })[0];
                    }
                    // --- LABELS
                    else if (annotation.type === "LABEL") {
                        _annotation.targetPoint = {
                            x: annotation.targetPoint.x * width,
                            y: annotation.targetPoint.y * height
                        }
                        _annotation.labelPoint = {
                            x: annotation.labelPoint.x * width,
                            y: annotation.labelPoint.y * height
                        }
                    }

                    // --- OTHER CASES
                    else {
                        _annotation.points = resolvePoints({ points: annotationPoints, pointsIndex, imageSize: baseMap.image.imageSize });
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


                // -- SORT --

                const annotationById = getItemsByKey(_annotations, "id");

                const sortedAnnotationIds = [];
                listings.forEach((listing) => {
                    if (listing.sortedAnnotationIds) {
                        sortedAnnotationIds.push(...listing.sortedAnnotationIds);
                    } else {
                        sortedAnnotationIds.push(
                            ..._annotations
                                .filter((a) => a.listingId === listing.id)
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
            }

        }, [baseMap?.id]);



        // override with annotation templates
        annotations = annotations?.map(annotation => {
            const templateProps = getAnnotationTemplateProps(annotationTemplatesMap[annotation?.annotationTemplateId])
            return {
                ...annotation,
                ...templateProps,
                label: annotation?.label ?? templateProps?.label
            }
        })


        // override with temp annotations
        annotations = [...(annotations ?? []), ...(tempAnnotations ?? [])];

        // bg image text annotations
        annotations = [...(annotations ?? []), ...(bgImageTextAnnotations ?? [])];


        // return 

        return annotations;
    } catch (e) {
        console.log(e);
        return [];
    }
}