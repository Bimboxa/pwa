import { useSelector } from "react-redux";

import useListings from "Features/listings/hooks/useListings";

import db from "App/db/db";
import { useLiveQuery } from "dexie-react-hooks";

export default function useLegendItems() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listings = useListings({ filterByProjectId: projectId });

  // helpers

  const legendListing = listings?.find(
    (listing) => listing?.entityModel?.type === "LEGEND_ENTITY"
  );

  console.log("debug_0910 legendListing", listings);

  const legendEntity = useLiveQuery(async () => {
    if (legendListing?.id) {
      return await db.legends
        .where("listingId")
        .equals(legendListing?.id)
        .first();
    }
  }, [legendListing?.id]);

  // main

  return legendEntity?.sortedItems;
}
