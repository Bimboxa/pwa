import { useMemo } from "react";

import useBusinessObjects from "Features/businessObjects/hooks/useBusinessObjects";

import sortPhases from "../utils/sortPhases";

const EMPTY = [];

// Ordered phases of a PHASING listing (stable empty array without listing).
export default function usePhases(listingId) {
  const { value: businessObjects } = useBusinessObjects({ listingId });

  return useMemo(() => {
    if (!listingId || !businessObjects?.length) return EMPTY;
    return sortPhases(businessObjects);
  }, [listingId, businessObjects]);
}
