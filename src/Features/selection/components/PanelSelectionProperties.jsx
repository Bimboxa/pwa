import { useSelector } from "react-redux";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";


import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingProperties from "Features/listings/components/PanelListingProperties";
import PanelEditEntity from "Features/entities/components/PanelEditEntity";

import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";

export default function PanelSelectionProperties() {

  // data
  const selectedItem = useSelector((s) => s.selection.selectedItem);
  const { value: listing } = useSelectedListing(selectedItem?.listingId);
  const entityId = useSelector((s) => s.entities.selectedEntityId);
  const annotation = useSelectedAnnotation();


  console.log("debug_0602_entityId", entityId);

  // helper - type

  let type = "LISTING";
  if (entityId) type = "ENTITY";
  // if (annotation) type = "ANNOTATION";

  return (
    <BoxFlexVStretch>
      {type === "LISTING" && (
        <PanelListingProperties listing={listing} />
      )}

      {type === "ENTITY" && (
        <PanelEditEntity />
      )}

      {type === "ANNOTATION" && (
        <PanelEntityInRightPanel selectedItem={annotation} />
      )}
    </BoxFlexVStretch>
  );
}
