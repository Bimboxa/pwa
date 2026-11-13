import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import db from "App/db/db";

import { selectSectionBaseMapPlacement } from "../sectionBaseMapPlacementSlice";

// Folder (base maps listing) receiving the blank page of the « + fond de
// plan » placement: the one picked in the drawing helper, else the first
// folder of vertical base maps (`listing.verticalBaseMaps`), else the folder
// of the plan hosting the section mark, else the first one.
//
// Returns { listings, listing }.
export default function useSectionBaseMapListing() {
  // data

  const { sourceAnnotationId, listingId } = useSelector(
    selectSectionBaseMapPlacement
  );
  const listings = useProjectBaseMapListings() ?? [];

  const planListingId = useLiveQuery(async () => {
    if (!sourceAnnotationId) return null;
    const source = await db.annotations.get(sourceAnnotationId);
    if (!source?.baseMapId) return null;
    return (await db.baseMaps.get(source.baseMapId))?.listingId ?? null;
  }, [sourceAnnotationId]);

  // helpers

  const listing =
    listings.find((l) => l.id === listingId) ??
    listings.find((l) => l.verticalBaseMaps) ??
    listings.find((l) => l.id === planListingId) ??
    listings[0] ??
    null;

  return { listings, listing };
}
