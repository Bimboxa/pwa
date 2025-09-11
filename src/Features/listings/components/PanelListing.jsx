import { useDispatch } from "react-redux";

import { setOpenLeftPanel } from "Features/leftPanel/leftPanelSlice";

import { Box, IconButton } from "@mui/material";
import { ArrowBackIos } from "@mui/icons-material";

//import Panel from "Features/layout/components/Panel";
import HeaderListing from "Features/listings/components/HeaderListing";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import SectionLegendInListPanel from "Features/legend/components/SectionLegendEntityInListPanel";

export default function PanelListing({ listing, onOpenSelectorListing }) {
  const dispatch = useDispatch();

  // strings

  const openSelectorListingLabel = "Voir toutes les listes";

  // helpers

  let type = "DEFAULT";
  if (listing?.entityModel?.type === "LEGEND_ENTITY") type = "LEGEND";

  // handlers

  function handleClose() {
    dispatch(setOpenLeftPanel(false));
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "space-between", p: 0.5 }}>
        <ButtonGeneric
          label={openSelectorListingLabel}
          onClick={onOpenSelectorListing}
        />
        <IconButton onClick={handleClose}>
          <ArrowBackIos />
        </IconButton>
      </Box>

      <HeaderListing listing={listing} />

      <BoxFlexVStretch>
        {type === "DEFAULT" && <SectionListEntitiesInListPanel />}
        {type === "LEGEND" && <SectionLegendInListPanel listing={listing} />}
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
