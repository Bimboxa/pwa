import { useState } from "react";
import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useSelectedEntity(options) {
  // options

  const withImages = options?.withImages;
  const fromListingId = options?.fromListingId;
  const entityId = options?.entityId;
  const withAnnotations = options?.withAnnotations;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const _selectedEntityId = useSelector((s) => s.entities.selectedEntityId);
  const { value: _listing } = useSelectedListing();
  const annotationTemplates = useAnnotationTemplates();

  const entity = useLiveQuery(async () => {
    // selectedId
    const selectedEntityId = entityId ?? _selectedEntityId;

    // listing & table
    let listing = _listing;
    if (fromListingId) {
      listing = await db.listings.get(fromListingId);
    }
    const table = listing?.table;
    const entityModel = listing?.entityModel;

    /// edge case
    if (!selectedEntityId || !table) {
      setLoading(false);
      return null;
    }

    const entity = await db[table].get(selectedEntityId);

    let _entity = { ...entity, entityModelKey: listing.entityModelKey };

    // label & subLabel

    if (entityModel?.labelKey && _entity)
      _entity[entityModel.labelKey] = _entity[entityModel.labelKey];
    if (entityModel?.subLabelKey && _entity)
      _entity[entityModel.subLabelKey] = _entity[entityModel.subLabelKey];

    // add images
    if (withImages) {
      const entriesWithImages = Object.entries(_entity).filter(
        ([key, value]) => value?.isImage
      );

      if (entriesWithImages?.length > 0)
        await Promise.all(
          entriesWithImages.map(async ([key, value]) => {
            const file = await db.files.get(value.fileName);
            if (file && file.fileArrayBuffer) {
              _entity[key] = {
                ...value,
                file,
                imageUrlClient: URL.createObjectURL(
                  new Blob([file.fileArrayBuffer], { type: file.fileMime })
                ),
              };
            }
          })
        );
    }

    // add annotations
    if (withAnnotations) {
      const annotationTemplatesById = getItemsByKey(annotationTemplates, "id");
      let annotations = await db.annotations
        .where("entityId")
        .equals(selectedEntityId)
        .toArray();

      annotations = annotations.map((annotation) => {
        const annotationTemplate =
          annotationTemplatesById[annotation?.annotationTemplateId];
        return {
          ...annotation,
          label: annotationTemplate?.label,
        };
      });
      _entity.annotations = annotations;
    }

    return _entity;
  }, [_selectedEntityId, entityId, _listing?.table, fromListingId]);

  return { value: entity, loading };
}
