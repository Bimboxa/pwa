import { Box } from "@mui/material";

import SelectorListingForViewer from "Features/listingViewer/components/SelectorListingForViewer";
import ButtonClearScopeFilters from "./ButtonClearScopeFilters";

import useScopeListing from "Features/listingViewer/hooks/useScopeListing";

// "Contenu" side of PopperMapListings (SCOPE module): every listing of the
// scope whatever its nature, grouped by family — the list the former scope
// panel showed, under the popper's own header. Picking a listing narrows the
// pinned base maps grid (useScopeGridAnnotationsFilter) and sends the
// listing's properties to the right panel; "Afficher toutes les listes" (the
// default) shows the whole scope. « Supprimer les filtres » on top while
// the « Annotations » / « Fonds de plan » tabs hide something.
export default function SectionPopperScopeContent() {
  // data

  const { listing, showAllListings } = useScopeListing();

  // render

  return (
    <Box>
      <ButtonClearScopeFilters />
      <SelectorListingForViewer
        selectedListingId={listing?.id ?? null}
        showAllListings={showAllListings}
        hideHeader
      />
    </Box>
  );
}
