import { useSelector } from "react-redux";
import { selectSelectedItems } from "../selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";


import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingProperties from "Features/listings/components/PanelListingProperties";
import PanelEditEntity from "Features/entities/components/PanelEditEntity";
import PanelAnnotationProperties from "Features/annotations/components/PanelAnnotationProperties";

import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import PanelAnnotationTemplateProperties from "Features/annotations/components/PanelAnnotationTemplateProperties";

export default function PanelSelectionProperties() {

  // data
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const { value: listing } = useSelectedListing(selectedItem?.listingId);
  const entityId = useSelector((s) => s.entities.selectedEntityId);

  console.log("debug_0602_entityId", entityId);

  // helper - type

  let type = "LISTING";
  if (entityId) type = "ENTITY";
  if (selectedItem?.nodeType === "ANNOTATION") type = "ANNOTATION";
  if (selectedItem?.type === "ANNOTATION_TEMPLATE") type = "ANNOTATION_TEMPLATE";

  return (
    <BoxFlexVStretch>
      {type === "LISTING" && (
        <PanelListingProperties listing={listing} />
      )}

      {type === "ENTITY" && (
        <PanelEditEntity />
      )}

      {type === "ANNOTATION" && (
        <PanelAnnotationProperties />
      )}

      {type === "ANNOTATION_TEMPLATE" && <PanelAnnotationTemplateProperties />}
    </BoxFlexVStretch>
  );
}
