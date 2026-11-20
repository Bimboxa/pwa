import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListings from "Features/listings/hooks/useListings";

import { PROMPT_IA_PROCEDURE } from "Features/promptIa/utils/promptIaProcedure";

// "Dessin auto" procedures of the selected scope, one entry per
// (listing, linked procedure) pair, in the listings order — the bands
// SectionListingProcedures shows in PopperMapListings: registry procedures of
// `listing.procedureKeys`, plus the virtual Prompt IA one when enabled.
// Returns [{ listingId, listingName, procedureKey, procedureLabel }].
export default function useScopeListingProcedures() {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const appConfig = useAppConfig();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  // helpers

  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  return (listings ?? []).flatMap((listing) => {
    const linked = (listing.procedureKeys ?? [])
      .map((key) => procedures.find((p) => p.key === key))
      .filter(Boolean);
    if (listing.promptIaEnabled) linked.push(PROMPT_IA_PROCEDURE);
    return linked.map((procedure) => ({
      listingId: listing.id,
      listingName: listing.name ?? listing.label ?? "Liste",
      procedureKey: procedure.key,
      procedureLabel: procedure.label,
    }));
  });
}
