import { useSelector } from "react-redux";

import useBusinessObjectListings from "Features/businessObjects/hooks/useBusinessObjectListings";

import { PHASING_TYPE_KEY } from "../constants";

// The PHASING listing driving the phases strip: the one picked in the
// Phasage module (phasing.activeListingId, kept in sync by StripPhases),
// else the first of the scope. `listings`: every PHASING listing of the
// scope (undefined while loading).
export default function usePhasingListing() {
  const activeListingId = useSelector((s) => s.phasing.activeListingId);
  const listings = useBusinessObjectListings({ typeKey: PHASING_TYPE_KEY });

  const listing =
    listings?.find((l) => l.id === activeListingId) ?? listings?.[0] ?? null;

  return { listing, listings };
}
