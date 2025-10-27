import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import demoAnnotations from "../data/demoAnnotations";
import useBgImageTextAnnotations from "Features/bgImage/hooks/useBgImageTextAnnotations";

import db from "App/db/db";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

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

  // main

  let annotations = useLiveQuery(async () => {
    let _annotations;
    if (filterByBaseMapId) {
      _annotations = await db.annotations
        .where("baseMapId")
        .equals(filterByBaseMapId)
        .toArray();
    } else {
      _annotations = await db.annotations.toArray();
    }

    if (withListingName) {
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

      // Add listing name to annotations
      _annotations = _annotations.map((annotation) => ({
        ...annotation,
        listingName: listingsMap[annotation.listingId]?.name || "-?-",
      }));
    }

    if (withLabel) {
      _annotations = await Promise.all(
        _annotations.map(async (annotation) => {
          const templateId = annotation?.annotationTemplateId;
          if (templateId) {
            const template = await db.annotationTemplates.get(templateId);
            return { ...annotation, label: template.label };
          } else {
            return annotation;
          }
        })
      );
    }

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

  // demo

  if (addDemoAnnotations)
    annotations = [...(annotations ?? []), ...demoAnnotations];

  if (addBgImageTextAnnotations) {
    annotations = [...(annotations ?? []), ...bgImageTextAnnotations];
  }

  // return

  return annotations;
}
