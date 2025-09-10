import { Box } from "@mui/material";

//import Panel from "Features/layout/components/Panel";
import HeaderListing from "Features/listings/components/HeaderListing";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import SectionLegendInListPanel from "Features/legend/components/SectionLegendEntityInListPanel";

export default function PanelListing({ listing, onOpenSelectorListing }) {
  // strings

  const openSelectorListingLabel = "Voir toutes les listes";

  console.log("listing", listing);

  // helpers

  let type = "DEFAULT";
  if (listing?.entityModel?.type === "LEGEND_ENTITY") type = "LEGEND";
  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "end", p: 0.5 }}>
        <ButtonGeneric
          label={openSelectorListingLabel}
          onClick={onOpenSelectorListing}
        />
      </Box>

      <HeaderListing listing={listing} />

      <BoxFlexVStretch>
        {type === "DEFAULT" && <SectionListEntitiesInListPanel />}
        {type === "LEGEND" && <SectionLegendInListPanel listing={listing} />}
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
