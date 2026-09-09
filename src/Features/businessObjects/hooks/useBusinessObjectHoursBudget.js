import { useMemo } from "react";

import useBusinessObjects from "./useBusinessObjects";
import useBusinessObjectQties from "./useBusinessObjectQties";

import { getHoursBudgetByObjectId } from "../utils/getBusinessObjectHoursBudget";

// Hours budget of a PLANNING listing's tasks: {ownById, totalById,
// grandTotal, businessObjects}. listingId null ⇒ empty result (the inner
// queries short-circuit), so callers can pass null for non-PLANNING
// listings and keep the hook call unconditional.
export default function useBusinessObjectHoursBudget({ listingId } = {}) {
  // data

  const { value: businessObjects } = useBusinessObjects({ listingId });
  const { qtiesByObjectId } = useBusinessObjectQties({ listingId });

  // main

  return useMemo(
    () => ({
      ...getHoursBudgetByObjectId(businessObjects ?? [], qtiesByObjectId),
      businessObjects: businessObjects ?? [],
    }),
    [businessObjects, qtiesByObjectId]
  );
}
