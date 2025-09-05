import { useLiveQuery } from "dexie-react-hooks";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

export default function useListingById(id) {
  // data

  const appConfig = useAppConfig();

  // main

  const listing = useLiveQuery(async () => {
    const _listing = await db.listings.get(id);

    const entityModel =
      appConfig?.entityModelsObject?.[_listing?.entityModelKey] ?? null;

    return { ..._listing, entityModel };
  }, [id]);

  return listing;
}
