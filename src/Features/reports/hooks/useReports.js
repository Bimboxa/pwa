import {useLiveQuery} from "dexie-react-hooks";
import {useSelector} from "react-redux";

import db from "App/db/db";

export default function useReports() {
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const reports = useLiveQuery(async () => {
    // const reports = await db.reports
    //   .where("listingId")
    //   .equals(listingId)
    //   .toArray();
    const reports = await db.reports.toArray();
    return reports;
  }, [listingId]);

  return reports;
}
