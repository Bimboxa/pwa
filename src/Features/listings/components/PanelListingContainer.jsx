import { useState } from "react";
import { useSelector } from "react-redux";

import useListingById from "../hooks/useListingById";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import PanelListing from "./PanelListing";
import PanelSelectorListing from "./PanelSelectorListing";

export default function PanelListingContainer() {
  // state

  const [openSelectorPanel, setOpenSelectorPanel] = useState(false);

  // data

  const listingId = useSelector((s) => s.listings.selectedListingId);
  const listing = useListingById(listingId);

  // handlers

  function handleSelectListing(listing) {
    console.log("[PanelListingContainer] handleSelectListing", listing);
    setOpenSelectorPanel(false);
  }

  // render

  return (
    <BoxFlexVStretch>
      {openSelectorPanel ? (
        <PanelSelectorListing
          selectedListingId={listingId}
          onListingSelected={handleSelectListing}
        />
      ) : (
        <PanelListing
          listing={listing}
          onOpenSelectorListing={() => setOpenSelectorPanel(true)}
        />
      )}
    </BoxFlexVStretch>
  );
}
