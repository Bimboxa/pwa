import { useState } from "react";
import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useSelectedEntity(options) {
  // options

  const withImages = options?.withImages;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);
  const { value: listing } = useSelectedListing();

  const entity = useLiveQuery(async () => {
    if (!selectedEntityId || !listing?.table) {
      setLoading(false);
      return null;
    }

    const table = listing?.table;
    const entity = await db[table].get(selectedEntityId);

    let _entity = { ...entity };

    // add images
    if (withImages) {
      const entriesWithImages = Object.entries(_entity).filter(
        ([key, value]) => value?.isImage
      );
      await Promise.all(
        entriesWithImages.map(async ([key, value]) => {
          const file = await db.files.get(value.fileName);
          if (file && file.file) {
            _entity[key] = {
              ...value,
              file,
              imageUrlClient: URL.createObjectURL(file.file),
            };
          }
        })
      );
    }

    // add listing
    _entity.listing = listing;
    return _entity;
  }, [selectedEntityId, listing?.table]);

  return { value: entity, loading };
}
