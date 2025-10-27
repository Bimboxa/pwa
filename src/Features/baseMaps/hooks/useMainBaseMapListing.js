import { useSelector } from "react-redux";

import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useMainBaseMapListing() {
  // data

  const baseMap = useMainBaseMap();

  return useLiveQuery(async () => {
    if (baseMap?.id) return await db.listings.get(baseMap.listingId);
  }, [baseMap?.id]);
}
