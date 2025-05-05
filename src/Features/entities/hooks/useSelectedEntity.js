import {useState} from "react";
import {useSelector} from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {useLiveQuery} from "dexie-react-hooks";

import db from "App/db/db";

export default function useSelectedEntity(options) {
  // options

  const withImages = options?.withImages;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);
  const {value: listing} = useSelectedListing();

  const entity = useLiveQuery(async () => {
    if (!selectedEntityId) {
      setLoading(false);
      return null;
    }
    try {
      const table = listing?.table;
      const entity = await db[table].get(selectedEntityId);

      // add images
      if (withImages) {
        const entityWithImages = {...entity};
        const entriesWithImages = Object.entries(entity).filter(
          ([key, value]) => value?.isImage
        );
        await Promise.all(
          entriesWithImages.map(async ([key, value]) => {
            const file = await db.files.get(value.fileName);
            if (file && file.file) {
              console.log("debug_2804_2 file from files db", file);
              entityWithImages[key] = {
                ...value,
                file,
                imageUrlClient: URL.createObjectURL(file.file),
              };
            }
          })
        );
        return entityWithImages;
      }

      setLoading(false);
      return entity;
    } catch (e) {
      console.log("[db] error fetching entity", e);
      return null;
    }
  }, [selectedEntityId]);

  return {value: entity, loading};
}
