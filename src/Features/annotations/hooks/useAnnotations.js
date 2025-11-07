import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import demoAnnotations from "../data/demoAnnotations";
import useBgImageTextAnnotations from "Features/bgImage/hooks/useBgImageTextAnnotations";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import db from "App/db/db";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

export default function useAnnotations(options) {
  // options

  const addDemoAnnotations = options?.addDemoAnnotations;
  const filterByBaseMapId = options?.filterByBaseMapId;
  const filterByListingId = options?.filterByListingId;
  const excludeListingsIds = options?.excludeListingsIds;
  const addBgImageTextAnnotations = options?.addBgImageTextAnnotations;

  const withEntity = options?.withEntity;
  const withLabel = options?.withLabel;
  const withListingName = options?.withListingName;

  // data

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const editedAnnotation = useSelector((s) => s.annotations.editedAnnotation);
  const isEditingAnnotation = useSelector(
    (s) => s.annotations.isEditingAnnotation
  );
  const bgImageTextAnnotations = useBgImageTextAnnotations();
  const bgImageRawTextAnnotationsUpdatedAt = useSelector(
    (s) => s.bgImage.bgImageRawTextAnnotationsUpdatedAt
  );

  const annotationTemplatesUpdatedAt = useSelector(
    (s) => s.annotations.annotationTemplatesUpdatedAt
  );
  const annotationTemplates = useAnnotationTemplates();
  const annotationTemplatesMap = getItemsByKey(annotationTemplates, "id");

  // main

  let annotations = useLiveQuery(async () => {
    let _annotations;

    // -- FILTER --

    if (filterByBaseMapId) {
      _annotations = await db.annotations
        .where("baseMapId")
        .equals(filterByBaseMapId)
        .toArray();
    } else {
      _annotations = await db.annotations.toArray();
    }

    if (filterByListingId) {
      _annotations = _annotations.filter(
        (a) => filterByListingId === a.listingId
      );
    }

    if (excludeListingsIds) {
      _annotations = _annotations?.filter(
        (a) => !excludeListingsIds.includes(a.listingId)
      );
    }

    _annotations = _annotations.filter((a) => Boolean(a.entityId));

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

    // -- RELATION --

    if (withListingName) {
      // Add listing name to annotations
      _annotations = _annotations.map((annotation) => ({
        ...annotation,
        listingName: listingsMap[annotation?.listingId]?.name || "-?-",
      }));
    }

    // if (withLabel) {
    //   _annotations = await Promise.all(
    //     _annotations.map(async (annotation) => {
    //       const templateId = annotation?.annotationTemplateId;
    //       if (templateId) {
    //         const template = await db.annotationTemplates.get(templateId);
    //         return { ...annotation, label: template.label };
    //       } else {
    //         return annotation;
    //       }
    //     })
    //   );
    // }

    if (withEntity) {
      _annotations = await Promise.all(
        _annotations.map(async (annotation) => {
          const table = annotation?.listingTable;
          if (table) {
            const entity = await db[table].get(annotation.entityId);
            const { entityWithImages, hasImages } =
              await getEntityWithImagesAsync(entity);
            return { ...annotation, entity: entityWithImages, hasImages };
          } else {
            return annotation;
          }
        })
      );
    }

    // edition
    if (isEditingAnnotation) {
      _annotations = _annotations.filter((a) => a.id !== editedAnnotation.id);
      _annotations.push(editedAnnotation);
    }

    return _annotations;
  }, [
    annotationsUpdatedAt,
    isEditingAnnotation,
    editedAnnotation,
    filterByListingId,
    filterByBaseMapId,
    excludeListingsIds,
    bgImageRawTextAnnotationsUpdatedAt,
  ]);

  // add annotation templates
  annotations = annotations?.map((annotation) => ({
    ...annotation,
    ...getAnnotationTemplateProps(
      annotationTemplatesMap[annotation?.annotationTemplateId]
    ),
  }));

  // demo

  if (addDemoAnnotations)
    annotations = [...(annotations ?? []), ...demoAnnotations];

  if (addBgImageTextAnnotations) {
    annotations = [...(annotations ?? []), ...bgImageTextAnnotations];
  }

  // return

  return annotations;
}
