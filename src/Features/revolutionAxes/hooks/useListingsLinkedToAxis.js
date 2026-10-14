import { useMemo } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import {
  getListingAxisProcedures,
  getListingProcedureAxisId,
} from "../utils/getRevolutionAxisProcedures";

const EMPTY = [];

// Listing-level procedures of the current scope bound to a revolution axis
// through their axis parameter (listing.procedureParams[key][axisParam] —
// e.g. the château d'eau surfaces listing whose « Axe » is this axis).
//
// Returns [{ listing, procedure }].
export default function useListingsLinkedToAxis(axisId) {
  const appConfig = useAppConfig();
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  return useMemo(() => {
    if (!axisId) return EMPTY;
    const procedures = getListingAxisProcedures(
      appConfig?.automatedAnnotationsProcedures
    );
    const items = [];
    for (const listing of listings ?? []) {
      if (listing.deletedAt) continue;
      for (const procedure of procedures) {
        if (!(listing.procedureKeys ?? []).includes(procedure.key)) continue;
        if (getListingProcedureAxisId(listing, procedure) !== axisId) continue;
        items.push({ listing, procedure });
      }
    }
    return items;
  }, [axisId, listings, appConfig?.automatedAnnotationsProcedures]);
}
