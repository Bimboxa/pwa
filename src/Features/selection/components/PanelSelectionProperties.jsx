import { useSelector } from "react-redux";
import { selectSelectedItems } from "../selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";


import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingProperties from "Features/listings/components/PanelListingProperties";
import PanelAnnotationProperties from "Features/annotations/components/PanelAnnotationProperties";

import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import PanelAnnotationTemplateProperties from "Features/annotations/components/PanelAnnotationTemplateProperties";
import PanelEntityProperties from "Features/entities/components/PanelEntityProperties";

export default function PanelSelectionProperties() {

  // data
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const { value: listing } = useSelectedListing(selectedItem?.listingId);
  const entityId = useSelector((s) => s.entities.selectedEntityId);

  console.log("debug_0602_selectedItem", selectedItem);

  // helper - type

  let type = "LISTING";
  if (selectedItem?.type === "ENTITY") {
    type = "ENTITY";
  }
  else if (selectedItem?.nodeType === "ANNOTATION" && selectedItem.type === "NODE") {
    type = "ANNOTATION";
  }
  else if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
    type = "ANNOTATION_TEMPLATE";
  }

  return (
    <BoxFlexVStretch>
      {type === "LISTING" && (
        <PanelListingProperties listing={listing} />
      )}

      {type === "ENTITY" && (
        <PanelEntityProperties />
      )}

      {type === "ANNOTATION" && (
        <PanelAnnotationProperties />
      )}

      {type === "ANNOTATION_TEMPLATE" && <PanelAnnotationTemplateProperties />}
    </BoxFlexVStretch>
  );
}
