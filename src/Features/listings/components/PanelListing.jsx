import { Box } from "@mui/material";

//import Panel from "Features/layout/components/Panel";
import HeaderListing from "Features/listings/components/HeaderListing";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PanelListing({ listing, onOpenSelectorListing }) {
  // strings

  const openSelectorListingLabel = "Voir toutes les listes";

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
        <SectionListEntitiesInListPanel />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
