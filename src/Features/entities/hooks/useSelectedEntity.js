import { useState } from "react";
import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useSelectedEntity(options) {
  // options

  const withImages = options?.withImages;
  const fromListingId = options?.fromListingId;
  const entityId = options?.entityId;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const _selectedEntityId = useSelector((s) => s.entities.selectedEntityId);
  const { value: _listing } = useSelectedListing();

  const entity = useLiveQuery(async () => {
    // selectedId
    const selectedEntityId = entityId ?? _selectedEntityId;

    // listing & table
    let listing = _listing;
    if (fromListingId) {
      listing = await db.listings.get(fromListingId);
    }
    const table = listing?.table;

    /// edge case
    if (!selectedEntityId || !table) {
      setLoading(false);
      return null;
    }

    const entity = await db[table].get(selectedEntityId);

    let _entity = { ...entity, entityModelKey: listing.entityModelKey };

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

    return _entity;
  }, [_selectedEntityId, entityId, _listing?.table, fromListingId]);

  return { value: entity, loading };
}
