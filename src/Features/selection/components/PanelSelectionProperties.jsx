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
import PanelPropertiesGuideline from "Features/annotations/components/PanelPropertiesGuideline";
import PanelPropertiesPointsAndSegments from "Features/points/components/PanelPropertiesPointsAndSegments";
import PanelMesh3dProperties from "Features/threedMesh/components/PanelMesh3dProperties";
import PanelPovProperties from "Features/pov/components/PanelPovProperties";
import PanelPovFrameProperties from "Features/pov/components/PanelPovFrameProperties";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

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
  const isPovViewer = selectedViewerKey === "POINT_OF_VIEW";

  const isMapViewer = selectedViewerKey === "MAP";
  const isListingViewer = selectedViewerKey === "LISTING";
  const isThreedViewer = isThreedFamilyViewerKey(selectedViewerKey);

  // The MAP and BASE_MAPS viewers share the same canvas (InteractionLayer), so
  // node / point / segment / guideline selections resolve the same way in both.
  const isCanvasViewer = isMapViewer || isBaseMapsViewer;

  let type = "LISTING";
  if (isPovViewer) {
    // POV viewer: either the selected POV, or the frame settings by default.
    type = selectedItem?.type === "POV" ? "POV" : "POV_FRAME";
  } else if (
    isCanvasViewer &&
    selectedPointIds.length > 0 &&
    selectedPartIds.length > 0 &&
    selectedItem?.type === "NODE"
  ) {
    // A lasso (or successive shift+clicks) caught both vertices and segments of
    // the selected annotation: show the combined panel exposing both control
    // sets, with shortcuts to narrow down to one kind.
    type = "POINTS_AND_SEGMENTS";
  } else if (
    isCanvasViewer &&
    selectedPointIds.length > 0 &&
    selectedItem?.type === "NODE"
  ) {
    // Per-point selection wins over annotation panels: when one or more
    // vertices of the selected annotation are in selectedPointIds, show the
    // point-level properties instead of the annotation/multi-annotation panel.
    type = "POINTS";
  } else if (
    isCanvasViewer &&
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
  } else if (
    isCanvasViewer &&
    selectedItem?.type === "NODE" &&
    String(selectedItem?.partId || "").split("::")[1] === "GUIDE_LINE"
  ) {
    // The guideLine (ramp axis) is sub-selected: show its dedicated panel
    // exposing the slope (%) and a "..." menu with Supprimer.
    type = "GUIDE";
  } else if (isMapViewer && !selectedItem) {
    type = "MAP_SUMMARY";
  } else if (
    isCanvasViewer &&
    selectedItems.length > 1 &&
    selectedItem?.type === "NODE"
  ) {
    type = "MULTI_ANNOTATION";
  } else if (
    isThreedViewer &&
    selectedItem?.type === "NODE" &&
    selectedItem?.nodeType === "MESH3D"
  ) {
    // Maille(s) selected in the 3D viewer — the panel handles both single and
    // multi selections (mirroring ToolbarEditMesh3d / ToolbarEditMeshes3d).
    type = "MESH3D";
  } else if (
    isThreedViewer &&
    selectedItem?.type === "NODE" &&
    selectedItem?.nodeType === "ANNOTATION"
  ) {
    // 3D viewer selection (click or lasso): the 3D editor never sets the 2D
    // InteractionLayer flag showAnnotationsProperties, so map the annotation
    // node(s) directly to the annotation panels instead of falling through to
    // the LISTING default.
    type = selectedItems.length > 1 ? "MULTI_ANNOTATION" : "ANNOTATION";
  } else if (
    (isMapViewer || isThreedViewer) &&
    selectedItem?.type === "BASE_MAP"
  ) {
    // 3D viewer: clicking a baseMap plane selects it as a BASE_MAP item
    // (MainThreedEditor.handleClick) — show the same panel as the 2D editor.
    type = "BASE_MAP";
  } else if (isBaseMapsViewer && selectedItem?.type === "SCOPE") {
    // Allow navigating back to the scope panel from the baseMap properties.
    type = "SCOPE";
  } else if (isBaseMapsViewer && !selectedItem) {
    // Empty selection (e.g. after Escape): show the baseMap properties
    // (transform operations). A selected drawing instead falls through to the
    // viewer-agnostic branches below (ENTITY / ANNOTATION / ...), mirroring MAP.
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
  } else if (isBaseMapsViewer) {
    // Safety fallback in the BASE_MAPS viewer: a persisted selection of a type
    // not handled above (e.g. a LISTING left over from another viewer) still
    // shows the baseMap properties rather than the default LISTING panel.
    type = "BASE_MAP";
  }

  // render

  return (
    <BoxFlexVStretch>
      {type === "MAP_SUMMARY" && <PanelPropertiesScope />}

      {/* THREED uses the V2 panel too so the back chain ends listing → scope,
          matching the 2D editor. */}
      {type === "LISTING" && (isMapViewer || isListingViewer || isThreedViewer) && <PanelPropertiesListingV2 listing={listing} />}
      {type === "LISTING" && !isMapViewer && !isListingViewer && !isThreedViewer && <PanelListingProperties listing={listing} />}

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

      {type === "GUIDE" && <PanelPropertiesGuideline />}

      {type === "POINTS_AND_SEGMENTS" && <PanelPropertiesPointsAndSegments />}

      {type === "MESH3D" && <PanelMesh3dProperties />}


      {type === "POV" && <PanelPovProperties />}

      {type === "POV_FRAME" && <PanelPovFrameProperties />}
    </BoxFlexVStretch>
  );
}
