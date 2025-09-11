import { useState } from "react";

import useSelectedListing from "../hooks/useSelectedListing";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import PanelListing from "./PanelListing";
import PanelSelectorListing from "./PanelSelectorListing";

export default function PanelListingContainer({ openedPanel, onChange }) {
  const { value: listing } = useSelectedListing();

  // handlers

  function handleSelectListing(listing) {
    console.log("[PanelListingContainer] handleSelectListing", listing);
    onChange("LISTING");
  }

  // render

  return (
    <BoxFlexVStretch>
      {openedPanel === "LISTING_SELECTOR" && (
        <PanelSelectorListing
          selectedListingId={listing?.id}
          onListingSelected={handleSelectListing}
        />
      )}

      {openedPanel === "LISTING" && <PanelListing listing={listing} />}
    </BoxFlexVStretch>
  );
}
