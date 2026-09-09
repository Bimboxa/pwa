import { useMemo } from "react";

import useBusinessObjectListings from "Features/businessObjects/hooks/useBusinessObjectListings";

import useNotesAppScopeLink from "./useNotesAppScopeLink";
import { getNotesAppSettings } from "../utils/notesAppListingSettings";

// Candidate listings for the references of a Krnet field (category
// nomenclature, link target / sources) = the OTHER business-object listings
// of the scope; nomenclatures must be in Krnet "tree mode" (parity with the
// mobile FieldEditor). `ignoredRemoteIds` = Krnet lists the user chose not
// to sync: a ref pointing at one of them is kept and labelled as such.
export default function useNotesAppListingRefs(listing) {
  const listings = useBusinessObjectListings();
  const { link } = useNotesAppScopeLink();

  return useMemo(() => {
    const all = (listings ?? []).filter((l) => !l.deletedAt);
    const others = all.filter((l) => l.id !== listing?.id);
    const listingById = Object.fromEntries(all.map((l) => [l.id, l]));
    const eligibleNomenclatures = others.filter(
      (l) => !!getNotesAppSettings(l).treeMode
    );
    const ignoredRemoteIds = new Set(
      (link?.listingsMapping ?? [])
        .filter((m) => m.mode === "ignored")
        .map((m) => m.remoteListingId)
    );
    return {
      listings: all,
      listingById,
      eligibleNomenclatures,
      linkTargets: others,
      ignoredRemoteIds,
    };
  }, [listings, listing?.id, link?.listingsMapping]);
}
