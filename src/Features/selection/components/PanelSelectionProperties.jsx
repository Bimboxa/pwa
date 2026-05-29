import { useSelector } from "react-redux";
import { selectSelectedItems, selectSelectedPointIds, selectSelectedPartIds } from "../selectionSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingById from "Features/listings/hooks/useListingById";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingProperties from "Features/listings/components/PanelListingProperties";
import PanelPropertiesListingV2 from "Features/listings/components/PanelPropertiesListingV2";
import PanelAnnotationProperties from "Features/annotations/components/PanelAnnotationProperties";
import PanelAnnotationTemplateProperties from "Features/annotations/components/PanelAnnotationTemplateProperties";
import PanelEntityProperties from "Features/entities/components/PanelEntityProperties";
import PanelBaseMapContainerProperties from "Features/portfolioEditor/components/PanelBaseMapContainerProperties";
import PanelLegendBlockProperties from "Features/portfolioEditor/components/PanelLegendBlockProperties";
import PanelPortfolioHeaderProperties from "Features/portfolioEditor/components/PanelPortfolioHeaderProperties";
import PanelPortfolioPageProperties from "Features/portfolioEditor/components/PanelPortfolioPageProperties";
import PanelBaseMapProperties from "Features/baseMaps/components/PanelBaseMapProperties";
import PanelBaseMapVersionProperties from "Features/baseMaps/components/PanelBaseMapVersionProperties";
import PanelLayerProperties from "Features/layers/components/PanelLayerProperties";
import PanelMultiAnnotationProperties from "./PanelMultiAnnotationProperties";
import PanelPropertiesScope from "Features/scopes/components/PanelPropertiesScope";
import PanelPropertiesPopperMapListings from "Features/popperMapListings/components/PanelPropertiesPopperMapListings";
import PanelPropertiesPoints from "Features/points/components/PanelPropertiesPoints";
import PanelPropertiesSegment from "Features/points/components/PanelPropertiesSegment";

export default function PanelSelectionProperties() {
  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const selectedPointIds = useSelector(selectSelectedPointIds);
  const selectedPartIds = useSelector(selectSelectedPartIds);
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

  const isMapViewer = selectedViewerKey === "MAP";
  const isListingViewer = selectedViewerKey === "LISTING";

  let type = "LISTING";
  if (
    isMapViewer &&
    selectedPointIds.length > 0 &&
    selectedItem?.type === "NODE"
  ) {
    // Per-point selection wins over annotation panels: when one or more
    // vertices of the selected annotation are in selectedPointIds, show the
    // point-level properties instead of the annotation/multi-annotation panel.
    type = "POINTS";
  } else if (
    isMapViewer &&
    selectedItem?.type === "NODE" &&
    ["SEG", "CUT_SEG"].includes(
      String(selectedItem?.partId || "").split("::")[1]
    ) &&
    selectedPartIds.length <= 1
  ) {
    // A polygon/polyline segment is sub-selected: show its per-segment
    // properties (isoHeight flag + read-only endpoint offsets). Only when
    // a SINGLE segment is selected — multi-segment selections fall through
    // to the annotation panel, which detects the multi state via the
    // part hook and renders the sectioned UI.
    type = "SEGMENT";
  } else if (isMapViewer && !selectedItem) {
    type = "MAP_SUMMARY";
  } else if (
    isMapViewer &&
    selectedItems.length > 1 &&
    selectedItem?.type === "NODE"
  ) {
    type = "MULTI_ANNOTATION";
  } else if (isMapViewer && selectedItem?.type === "BASE_MAP") {
    type = "BASE_MAP";
  } else if (isBaseMapsViewer && selectedItem?.type === "SCOPE") {
    // Allow navigating back to the scope panel from the baseMap properties.
    type = "SCOPE";
  } else if (isBaseMapsViewer) {
    // In the BASE_MAPS viewer always show the baseMap properties (transforms),
    // even when the persisted selection is a LISTING/other type from another viewer.
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
  } else if (selectedItem?.type === "LAYER") {
    type = "LAYER";
  } else if (selectedItem?.type === "SCOPE") {
    type = "SCOPE";
  } else if (selectedItem?.type === "POPPER_MAP_LISTINGS") {
    type = "POPPER_MAP_LISTINGS";
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
      {type === "MAP_SUMMARY" && <PanelPropertiesScope />}

      {type === "LISTING" && (isMapViewer || isListingViewer) && <PanelPropertiesListingV2 listing={listing} />}
      {type === "LISTING" && !isMapViewer && !isListingViewer && <PanelListingProperties listing={listing} />}

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

      {type === "LAYER" && <PanelLayerProperties />}

      {type === "SCOPE" && <PanelPropertiesScope />}

      {type === "POPPER_MAP_LISTINGS" && <PanelPropertiesPopperMapListings />}

      {type === "MULTI_ANNOTATION" && <PanelMultiAnnotationProperties />}

      {type === "POINTS" && <PanelPropertiesPoints />}

      {type === "SEGMENT" && <PanelPropertiesSegment />}
    </BoxFlexVStretch>
  );
}
