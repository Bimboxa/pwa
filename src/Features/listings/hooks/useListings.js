import { useLiveQuery } from "dexie-react-hooks";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

export default function useListings(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;
  const filterByScopeId = options?.filterByScopeId;

  const filterByEntityModelType = options?.filterByEntityModelType;
  const relsZoneEntityListings = options?.relsZoneEntityListings;

  const includeListingsWithoutScope = options?.includeListingsWithoutScope;
  const withFiles = options?.withFiles;


  // data

  const appConfig = useAppConfig();

  // main

  const listings = useLiveQuery(async () => {
    // edge case

    if (!appConfig) return;

    // main

    let _listings;

    if (filterByProjectId) {
      _listings = (await db.listings
        .where("projectId")
        .equals(filterByProjectId)
        .toArray()).filter(r => !r.deletedAt);
    } else {
      _listings = (await db.listings.toArray()).filter(r => !r.deletedAt);
    }

    // add entityModel

    _listings = _listings?.map((_listing) => {
      const entityModel =
        appConfig?.entityModelsObject?.[_listing?.entityModelKey] ?? null;

      return { ..._listing, entityModel };
    });

    if (filterByScopeId) {
      _listings = _listings.filter((listing) => {
        const test = testObjectHasProp(listing, "scopeId");
        const isLocatedEntities =
          listing.entityModel?.type === "LOCATED_ENTITY";
        return (
          (!test && !isLocatedEntities) ||
          (!listing.scopeId && includeListingsWithoutScope) ||
          (test && listing.scopeId === filterByScopeId)
        );
      });
    }

    // filter by entityModelType
    if (filterByEntityModelType) {
      _listings = _listings.filter(
        (l) => l.entityModel?.type === filterByEntityModelType
      );
    }

    // keep relsZoneEntityListings
    if (relsZoneEntityListings) {
      _listings = _listings.filter((listing) => {
        return Boolean(listing.entityModel?.relsZoneEntity);
      });
    }

    // load metadata files
    if (withFiles) {
      _listings = await Promise.all(
        _listings.map(async (listing) => {
          if (!listing.metadata) return listing;
          const entriesWithFiles = Object.entries(listing.metadata).filter(
            ([, value]) => value?.fileName
          );
          if (entriesWithFiles.length === 0) return listing;

          const processedMetadata = { ...listing.metadata };
          await Promise.all(
            entriesWithFiles.map(async ([key, value]) => {
              const file = await db.files.get(value.fileName);
              if (file && file.fileArrayBuffer) {
                processedMetadata[key] = {
                  ...value,
                  file,
                  fileUrlClient: URL.createObjectURL(
                    new Blob([file.fileArrayBuffer], { type: file.fileMime })
                  ),
                };
              }
            })
          );
          return { ...listing, metadata: processedMetadata };
        })
      );
    }

    return _listings;
  }, [appConfig, filterByProjectId, filterByScopeId, filterByEntityModelType, relsZoneEntityListings, withFiles]);

  return listings;
}
