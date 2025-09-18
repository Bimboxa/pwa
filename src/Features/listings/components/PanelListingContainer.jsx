import { useDispatch, useSelector } from "react-redux";

import { setOpenedPanel } from "../listingsSlice";

import useSelectedListing from "../hooks/useSelectedListing";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import PanelListing from "./PanelListing";
import PanelSelectorListing from "./PanelSelectorListing";
//import PanelCreateListingEntity from "Features/entities/components/PanelCreateListingEntity";
import PanelEditEntity from "Features/entities/components/PanelEditEntity";
import Panel from "Features/layout/components/Panel";

export default function PanelListingContainer() {
  const dispatch = useDispatch();

  // data

  const { value: listing } = useSelectedListing();
  const openedPanel = useSelector((s) => s.listings.openedPanel);
  console.log("[PanelListingContainer] openedPanel", openedPanel);

  // handlers

  function handleSelectListing(listing) {
    console.log("[PanelListingContainer] handleSelectListing", listing);
    dispatch(setOpenedPanel("LISTING"));
  }

  // render

  return (
    <BoxFlexVStretch
      sx={{ borderRight: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      {openedPanel === "LISTING_SELECTOR" && (
        <PanelSelectorListing
          selectedListingId={listing?.id}
          onListingSelected={handleSelectListing}
        />
      )}

      {openedPanel === "LISTING" && <PanelListing listing={listing} />}
      {openedPanel === "NEW_ENTITY" && <PanelEditEntity />}
      {openedPanel === "EDITED_ENTITY" && <PanelEditEntity />}
    </BoxFlexVStretch>
  );
}
