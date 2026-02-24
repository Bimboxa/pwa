import { useSelector } from "react-redux";
import { selectSelectedItems } from "../selectionSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingProperties from "Features/listings/components/PanelListingProperties";
import PanelAnnotationProperties from "Features/annotations/components/PanelAnnotationProperties";
import PanelAnnotationTemplateProperties from "Features/annotations/components/PanelAnnotationTemplateProperties";
import PanelEntityProperties from "Features/entities/components/PanelEntityProperties";
import PanelBaseMapContainerProperties from "Features/portfolioEditor/components/PanelBaseMapContainerProperties";
import PanelPortfolioHeaderProperties from "Features/portfolioEditor/components/PanelPortfolioHeaderProperties";

export default function PanelSelectionProperties() {
  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const { value: listing } = useSelectedListing(selectedItem?.listingId);
  const showAnnotationsProperties = useSelector(
    (s) => s.selection.showAnnotationsProperties
  );
  const selectedViewerKey = useSelector(
    (s) => s.viewers.selectedViewerKey
  );

  // helper - type

  const isPortfolioViewer = selectedViewerKey === "PORTFOLIO";

  let type = "LISTING";
  if (isPortfolioViewer) {
    if (selectedItem?.type === "BASE_MAP_CONTAINER") {
      type = "BASE_MAP_CONTAINER";
    } else {
      // PORTFOLIO_PAGE, PORTFOLIO_HEADER, PORTFOLIO, or no selection
      type = "PORTFOLIO_HEADER";
    }
  } else if (selectedItem?.type === "ENTITY") {
    type = "ENTITY";
  } else if (showAnnotationsProperties) {
    type = "ANNOTATION";
  } else if (
    selectedItem?.type === "NODE" &&
    selectedItem?.nodeType === "ANNOTATION" &&
    Boolean(selectedItem.entityId)
  ) {
    type = "ENTITY_WITH_ANNOTATIONS";
  } else if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
    type = "ANNOTATION_TEMPLATE";
  }

  // render

  return (
    <BoxFlexVStretch>
      {type === "LISTING" && <PanelListingProperties listing={listing} />}

      {type === "ENTITY" && <PanelEntityProperties />}

      {type === "ENTITY_WITH_ANNOTATIONS" && <PanelEntityProperties />}

      {type === "ANNOTATION" && <PanelAnnotationProperties />}

      {type === "ANNOTATION_TEMPLATE" && <PanelAnnotationTemplateProperties />}

      {type === "BASE_MAP_CONTAINER" && <PanelBaseMapContainerProperties />}

      {type === "PORTFOLIO_HEADER" && <PanelPortfolioHeaderProperties />}
    </BoxFlexVStretch>
  );
}
