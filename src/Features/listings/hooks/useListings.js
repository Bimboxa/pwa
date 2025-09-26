import { useLiveQuery } from "dexie-react-hooks";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

export default function useListings(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;
  const filterByEntityModelType = options?.filterByEntityModelType;
  const filterByScopeId = options?.filterByScopeId;

  // data

  const appConfig = useAppConfig();

  // main

  const listings = useLiveQuery(async () => {
    // edge case

    if (!appConfig) return;

    // main

    let _listings;

    if (filterByProjectId) {
      _listings = await db.listings
        .where("projectId")
        .equals(filterByProjectId)
        .toArray();
    } else {
      _listings = await db.listings.toArray();
    }

    if (filterByScopeId) {
      _listings = _listings.filter((listing) => {
        const test = testObjectHasProp(listing, "scopeId");
        return !test || (test && listing.scopeId === filterByScopeId);
      });
    }

    // add entityModel

    _listings = _listings.map((_listing) => {
      const entityModel =
        appConfig?.entityModelsObject?.[_listing?.entityModelKey] ?? null;

      return { ..._listing, entityModel };
    });

    // filter by entityModelType
    if (filterByEntityModelType) {
      _listings = _listings.filter(
        (l) => l.entityModel?.type === filterByEntityModelType
      );
    }

    return _listings;
  }, [appConfig, filterByProjectId, filterByScopeId, filterByEntityModelType]);

  return listings;
}
