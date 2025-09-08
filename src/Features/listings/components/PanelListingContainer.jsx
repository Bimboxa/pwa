import { useState } from "react";

import useSelectedListing from "../hooks/useSelectedListing";
import useEntities from "Features/entities/hooks/useEntities";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import PanelListing from "./PanelListing";
import PanelSelectorListing from "./PanelSelectorListing";

export default function PanelListingContainer() {
  // state

  const [openSelectorPanel, setOpenSelectorPanel] = useState(false);

  // data

  const { value: listing } = useSelectedListing();
  const { value: entities } = useEntities();

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
          selectedListingId={listing?.id}
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
