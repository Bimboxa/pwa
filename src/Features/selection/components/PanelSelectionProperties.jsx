import { useSelector } from "react-redux";
import { selectSelectedItems } from "../selectionSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingById from "Features/listings/hooks/useListingById";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingProperties from "Features/listings/components/PanelListingProperties";
import PanelAnnotationProperties from "Features/annotations/components/PanelAnnotationProperties";
import PanelAnnotationTemplateProperties from "Features/annotations/components/PanelAnnotationTemplateProperties";
import PanelEntityProperties from "Features/entities/components/PanelEntityProperties";
import PanelBaseMapContainerProperties from "Features/portfolioEditor/components/PanelBaseMapContainerProperties";
import PanelLegendBlockProperties from "Features/portfolioEditor/components/PanelLegendBlockProperties";
import PanelPortfolioHeaderProperties from "Features/portfolioEditor/components/PanelPortfolioHeaderProperties";
import PanelPortfolioPageProperties from "Features/portfolioEditor/components/PanelPortfolioPageProperties";
import PanelBaseMapProperties from "Features/baseMaps/components/PanelBaseMapProperties";
import PanelBaseMapVersionProperties from "Features/baseMaps/components/PanelBaseMapVersionProperties";

export default function PanelSelectionProperties() {
  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const { value: defaultListing } = useSelectedListing();
  const selectedViewerKey = useSelector(
    (s) => s.viewers.selectedViewerKey
  );
  const showAnnotationsProperties = useSelector(
    (s) => s.selection.showAnnotationsProperties
  );

  // When selectedItem is a LISTING (e.g. back from BASE_MAP), use its id directly
  const selectionListingId =
    selectedItem?.type === "LISTING" ? selectedItem.id : null;
  const listingById = useListingById(selectionListingId);
  const listing = listingById || defaultListing;

  // helper - type

  const isPortfolioViewer = selectedViewerKey === "PORTFOLIO";
  const isBaseMapsViewer = selectedViewerKey === "BASE_MAPS";

  let type = "LISTING";
  if (isBaseMapsViewer && selectedItem?.type === "BASE_MAP_VERSION") {
    type = "BASE_MAP_VERSION";
  } else if (isBaseMapsViewer && selectedItem?.type === "BASE_MAP") {
    type = "BASE_MAP";
  } else if (isPortfolioViewer) {
    if (selectedItem?.type === "LEGEND_BLOCK") {
      type = "LEGEND_BLOCK";
    } else if (selectedItem?.type === "BASE_MAP_CONTAINER") {
      type = "BASE_MAP_CONTAINER";
    } else if (selectedItem?.type === "PORTFOLIO_PAGE") {
      type = "PORTFOLIO_PAGE";
    } else {
      // PORTFOLIO_HEADER, PORTFOLIO, or no selection
      type = "PORTFOLIO_HEADER";
    }
  } else if (selectedItem?.type === "ENTITY") {
    type = "ENTITY";
  } else if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
    type = "ANNOTATION_TEMPLATE";
  } else if (showAnnotationsProperties) {
    type = "ANNOTATION";
  } else if (
    selectedItem?.type === "NODE" &&
    selectedItem?.nodeType === "ANNOTATION" &&
    Boolean(selectedItem.entityId)
  ) {
    type = "ENTITY_WITH_ANNOTATIONS";
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

      {type === "LEGEND_BLOCK" && <PanelLegendBlockProperties />}

      {type === "PORTFOLIO_PAGE" && <PanelPortfolioPageProperties />}

      {type === "PORTFOLIO_HEADER" && <PanelPortfolioHeaderProperties />}

      {type === "BASE_MAP" && <PanelBaseMapProperties />}

      {type === "BASE_MAP_VERSION" && <PanelBaseMapVersionProperties />}
    </BoxFlexVStretch>
  );
}
