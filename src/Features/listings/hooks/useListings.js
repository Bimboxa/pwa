import { useLiveQuery } from "dexie-react-hooks";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

export default function useListings(options) {
  // options

  const filterByProjectId = options.filterByProjectId;

  // data

  const appConfig = useAppConfig();

  // main

  const listings = useLiveQuery(async () => {
    // edge case

    if (!appConfig) return;

    // main

    let _listings;

    if (!filterByProjectId) {
      _listings = await db.listings
        .where("projectId")
        .equals(filterByProjectId)
        .toArray();
    } else {
      _listings = await db.listings.toArray();
    }

    // add entityModel

    _listings = _listings.map((_listing) => {
      const entityModel =
        appConfig?.entityModelsObject?.[_listing?.entityModelKey] ?? null;

      return { ..._listing, entityModel };
    });

    return _listings;
  }, [appConfig]);

  return listings;
}
