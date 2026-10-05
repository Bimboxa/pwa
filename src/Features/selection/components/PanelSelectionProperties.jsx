import { useSelector } from "react-redux";
import { selectSelectedItems, selectSelectedPointIds, selectSelectedPartIds } from "../selectionSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingById from "Features/listings/hooks/useListingById";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingProperties from "Features/listings/components/PanelListingProperties";
import PanelPropertiesListingV2 from "Features/listings/components/PanelPropertiesListingV2";
import PanelAnnotationProperties from "Features/annotations/components/PanelAnnotationProperties";
import PanelAnnotationLabelProperties from "Features/annotations/components/PanelAnnotationLabelProperties";
import PanelAnnotationTemplateProperties from "Features/annotations/components/PanelAnnotationTemplateProperties";
import PanelEntityProperties from "Features/entities/components/PanelEntityProperties";
import PanelBaseMapContainerProperties from "Features/portfolioEditor/components/PanelBaseMapContainerProperties";
import PanelLegendBlockProperties from "Features/portfolioEditor/components/PanelLegendBlockProperties";
import PanelPortfolioHeaderProperties from "Features/portfolioEditor/components/PanelPortfolioHeaderProperties";
import PanelPortfolioPageProperties from "Features/portfolioEditor/components/PanelPortfolioPageProperties";
import PanelPortfolioPageTitleProperties from "Features/portfolioEditor/components/PanelPortfolioPageTitleProperties";
import PanelPortfolioPageDetailRefProperties from "Features/portfolioEditor/components/PanelPortfolioPageDetailRefProperties";
import PanelBaseMapProperties from "Features/baseMaps/components/PanelBaseMapProperties";
import PanelBaseMapListingProperties from "Features/baseMapEditor/components/PanelBaseMapListingProperties";
import PanelBaseMapVersionProperties from "Features/baseMaps/components/PanelBaseMapVersionProperties";
import PanelLayerProperties from "Features/layers/components/PanelLayerProperties";
import PanelMultiAnnotationProperties from "./PanelMultiAnnotationProperties";
import PanelPropertiesScope from "Features/scopes/components/PanelPropertiesScope";
import PanelPropertiesPopperMapListings from "Features/popperMapListings/components/PanelPropertiesPopperMapListings";
import PanelPropertiesBaseMapsList from "Features/popperMapListings/components/PanelPropertiesBaseMapsList";
import PanelPropertiesPoints from "Features/points/components/PanelPropertiesPoints";
import PanelPropertiesSegment from "Features/points/components/PanelPropertiesSegment";
import PanelPropertiesGuideline from "Features/annotations/components/PanelPropertiesGuideline";
import PanelPropertiesPointsAndSegments from "Features/points/components/PanelPropertiesPointsAndSegments";
import PanelMesh3dProperties from "Features/threedMesh/components/PanelMesh3dProperties";
import PanelPhotoProperties from "Features/photos/components/PanelPhotoProperties";
import PanelPovProperties from "Features/pov/components/PanelPovProperties";
import PanelZoneProperties from "Features/zonings/components/PanelZoneProperties";
import PanelBusinessObjectProperties from "Features/businessObjects/components/PanelBusinessObjectProperties";
import PanelBusinessObjectListingProperties from "Features/businessObjects/components/PanelBusinessObjectListingProperties";
import PanelWorkPackageProperties from "Features/businessObjects/components/PanelWorkPackageProperties";
import PanelPovFrameProperties from "Features/pov/components/PanelPovFrameProperties";
import PanelPropertiesDrawing from "Features/panelDrawing/components/PanelPropertiesDrawing";
import PanelPropertiesBaseMapsModule from "Features/baseMapEditor/components/PanelPropertiesBaseMapsModule";
import PanelPropertiesModuleDefault from "Features/viewers/components/PanelPropertiesModuleDefault";
import PanelProcedureProperties from "Features/annotationsAuto/components/PanelProcedureProperties";
import PanelPropertiesMesh3dParts from "Features/annotationMesh3d/components/PanelPropertiesMesh3dParts";
import { getSelectedMesh3dParts } from "Features/annotationMesh3d/utils/mesh3dPartIds";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import getModuleRootPanelType from "../utils/getModuleRootPanelType";

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
  // Ouvrages module: active listing of the drawer, fallback of the default
  // (no-selection) listing panel.
  const businessObjectsListingId = useSelector(
    (s) => s.businessObjects.selectedListingId
  );
  const businessObjectsListingById = useListingById(businessObjectsListingId);

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
  const isScopeViewer = selectedViewerKey === "SCOPE";
  const isThreedViewer = isThreedFamilyViewerKey(selectedViewerKey);

  // The MAP and BASE_MAPS viewers share the same canvas (InteractionLayer), so
  // node / point / segment / guideline selections resolve the same way in both.
  const isCanvasViewer = isMapViewer || isBaseMapsViewer;

  // Root of the selection: nothing selected. Each module then shows its own
  // default panel (getModuleRootPanelType). A typeless item (`{}` left by
  // some delete flows) or a legacy SCOPE item count as an empty selection.
  const isRoot = !selectedItem?.type || selectedItem.type === "SCOPE";

  let type = "LISTING";
  if (isPovViewer) {
    // POV viewer: either the selected POV, or the frame settings by default.
    type = selectedItem?.type === "POV" ? "POV" : "POV_FRAME";
  } else if (getSelectedMesh3dParts(selectedItem, selectedPartIds).length > 0) {
    // Faces / edges of a mesh annotation sub-selected in the 3D editor: their
    // own panel (measures, deletion). Viewer-agnostic — the Dessin module
    // toggled to 3D keeps the "MAP" module key.
    type = "MESH3D_PARTS";
  } else if (selectedItem?.type === "PROCEDURE") {
    // Automated procedure opened from a listing's "Dessin auto" section or
    // from the listing properties: description, templates, parameters.
    type = "PROCEDURE";
  } else if (selectedItem?.type === "PHOTO") {
    // Photo selected from a photos grid (popper / panel) or its map node.
    type = "PHOTO";
  } else if (
    selectedItem?.type === "ANNOTATION_LABEL" &&
    selectedItems.length === 1
  ) {
    // Annotation label (2D chip / 3D card) selected: its own panel — the
    // former Etiquette tab. Back selects the parent annotation.
    type = "ANNOTATION_LABEL";
  } else if (
    isBusinessObjectsModuleKey(selectedViewerKey) &&
    selectedItem?.type === "WORK_PACKAGE"
  ) {
    // Work package selected in the PLANNING drawer ("Tâches" tab): the
    // package's properties (tasks, hours, annotations).
    type = "WORK_PACKAGE";
  } else if (
    isBusinessObjectsModuleKey(selectedViewerKey) &&
    selectedItem?.type === "BUSINESS_OBJECT"
  ) {
    // Business object selected in the Ouvrages drawer: the object's
    // properties (linked annotations + quantities). Selecting an annotation
    // on the map replaces it like any other selection — the SOLO display and
    // the module's ACTIVE object are separate states and survive it. Scoped
    // to the module: leaving it keeps the item, and the other modules must
    // fall through to their own default.
    type = "BUSINESS_OBJECT";
  } else if (isScopeViewer && selectedItem?.type === "LISTING") {
    // SCOPE module: listings of every nature sit in the same panel, so the
    // properties panel is chosen from the LISTING's own entityModel type
    // instead of the module key like the branches below. A business-objects
    // listing notably carries the notes-app (Krnet) sync configuration, which
    // only PanelBusinessObjectListingProperties exposes.
    const entityModelType = listing?.entityModel?.type;
    if (entityModelType === "BUSINESS_OBJECT") type = "BUSINESS_OBJECT_LISTING";
    else if (entityModelType === "BASE_MAP") type = "BASE_MAP_LISTING";
    else type = "LISTING";
  } else if (
    isBusinessObjectsModuleKey(selectedViewerKey) &&
    selectedItem?.type === "LISTING"
  ) {
    // Back arrow of the object properties panel (LISTING selection): the
    // listing properties (name + "Numérotation" display option) — the
    // BASE_MAP_LISTING pattern. Also the module's default panel, through the
    // root branch below.
    type = "BUSINESS_OBJECT_LISTING";
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
  } else if (isRoot) {
    // Nothing selected: the module's own default panel (Dessin, Fonds de
    // plan, scope, portfolio header, business-objects listing, or the generic
    // module panel). Before the showAnnotationsProperties branch: a stale
    // flag must not hide the module panel.
    type = getModuleRootPanelType(selectedViewerKey);
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
  } else if (selectedItem?.type === "BASE_MAP_VERSION") {
    // A version of a base map (row of the versions list in the base map
    // panel, or a version image clicked in the BASE_MAPS viewer): its own
    // panel — label, active switch, transforms. Before the BASE_MAPS
    // fallbacks, which would map it to the base map panel.
    type = "BASE_MAP_VERSION";
  } else if (
    (isMapViewer || isThreedViewer || isBaseMapsViewer) &&
    selectedItem?.type === "BASE_MAP"
  ) {
    // 3D viewer: clicking a baseMap plane selects it as a BASE_MAP item
    // (MainThreedEditor.handleClick) — show the same panel as the 2D editor.
    // BASE_MAPS module: a base map picked in the left tree, or through the
    // "Voir le détail" of a module panel.
    type = "BASE_MAP";
  } else if (isBaseMapsViewer && selectedItem?.type === "LISTING") {
    // A baseMap group is selected in the left tree. Without this branch, the
    // isBaseMapsViewer safety fallback below mapped it to BASE_MAP and showed
    // the baseMap properties instead.
    type = "BASE_MAP_LISTING";
  } else if (isPortfolioViewer) {
    if (selectedItem?.type === "LEGEND_BLOCK") {
      type = "LEGEND_BLOCK";
    } else if (selectedItem?.type === "BASE_MAP_CONTAINER") {
      type = "BASE_MAP_CONTAINER";
    } else if (selectedItem?.type === "PORTFOLIO_PAGE") {
      type = "PORTFOLIO_PAGE";
    } else if (selectedItem?.type === "PORTFOLIO_TITLE") {
      // the page title element opens its dedicated properties panel
      type = "PORTFOLIO_TITLE";
    } else if (selectedItem?.type === "PORTFOLIO_DETAIL_REF") {
      // the folio detail reference element opens its dedicated panel
      type = "PORTFOLIO_DETAIL_REF";
    } else {
      // PORTFOLIO_HEADER, PORTFOLIO
      type = "PORTFOLIO_HEADER";
    }
  } else if (selectedItem?.type === "ZONE") {
    // Zone selected in the zonings drawer (ZONES module): legend of the
    // annotations linked to the zone.
    type = "ZONE";
  } else if (selectedItem?.type === "ENTITY") {
    type = "ENTITY";
  } else if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
    type = "ANNOTATION_TEMPLATE";
  } else if (selectedItem?.type === "LAYER") {
    type = "LAYER";
  } else if (selectedItem?.type === "POPPER_MAP_LISTINGS") {
    type = "POPPER_MAP_LISTINGS";
  } else if (selectedItem?.type === "POPPER_BASE_MAPS") {
    type = "POPPER_BASE_MAPS";
  } else if (showAnnotationsProperties) {
    type = "ANNOTATION";
  } else if (
    selectedItem?.type === "NODE" &&
    selectedItem?.nodeType === "ANNOTATION"
  ) {
    // Annotation node selected without the showAnnotationsProperties flag
    // (e.g. a selection restored from another surface): still show the
    // annotation panel rather than the LISTING default.
    type = "ANNOTATION";
  } else if (isBaseMapsViewer) {
    // Safety fallback in the BASE_MAPS viewer: a persisted selection of a type
    // not handled above still shows the module panel rather than the default
    // LISTING panel.
    type = "BASE_MAPS_MODULE";
  }

  // render

  return (
    <BoxFlexVStretch>
      {type === "DRAWING_MODULE" && <PanelPropertiesDrawing />}

      {type === "BASE_MAPS_MODULE" && <PanelPropertiesBaseMapsModule />}

      {type === "MODULE_DEFAULT" && (
        <PanelPropertiesModuleDefault moduleKey={selectedViewerKey} />
      )}

      {/* THREED uses the V2 panel too so the back chain ends listing → scope,
          matching the 2D editor. */}
      {type === "LISTING" && (isMapViewer || isScopeViewer || isThreedViewer) && <PanelPropertiesListingV2 listing={listing} />}
      {type === "LISTING" && !isMapViewer && !isScopeViewer && !isThreedViewer && <PanelListingProperties listing={listing} />}

      {type === "ENTITY" && <PanelEntityProperties />}

      {type === "ANNOTATION" && <PanelAnnotationProperties />}

      {type === "MESH3D_PARTS" && <PanelPropertiesMesh3dParts />}

      {type === "ANNOTATION_LABEL" && <PanelAnnotationLabelProperties />}

      {type === "ANNOTATION_TEMPLATE" && <PanelAnnotationTemplateProperties />}

      {type === "BASE_MAP_CONTAINER" && <PanelBaseMapContainerProperties />}

      {type === "LEGEND_BLOCK" && <PanelLegendBlockProperties />}

      {type === "PORTFOLIO_PAGE" && <PanelPortfolioPageProperties />}

      {type === "PORTFOLIO_TITLE" && <PanelPortfolioPageTitleProperties />}

      {type === "PORTFOLIO_DETAIL_REF" && (
        <PanelPortfolioPageDetailRefProperties />
      )}

      {type === "PORTFOLIO_HEADER" && <PanelPortfolioHeaderProperties />}

      {type === "BASE_MAP" && <PanelBaseMapProperties />}

      {/* listingById (not `listing`): once the group is deleted the id no
          longer resolves and the panel renders nothing, instead of falling
          back to the drawing module's default listing. */}
      {type === "BASE_MAP_LISTING" && (
        <PanelBaseMapListingProperties listing={listingById} />
      )}

      {type === "BASE_MAP_VERSION" && <PanelBaseMapVersionProperties />}

      {type === "LAYER" && <PanelLayerProperties />}

      {type === "SCOPE" && <PanelPropertiesScope />}

      {type === "POPPER_MAP_LISTINGS" && <PanelPropertiesPopperMapListings />}

      {type === "POPPER_BASE_MAPS" && <PanelPropertiesBaseMapsList />}

      {type === "MULTI_ANNOTATION" && <PanelMultiAnnotationProperties />}

      {type === "POINTS" && <PanelPropertiesPoints />}

      {type === "SEGMENT" && <PanelPropertiesSegment />}

      {type === "GUIDE" && <PanelPropertiesGuideline />}

      {type === "POINTS_AND_SEGMENTS" && <PanelPropertiesPointsAndSegments />}

      {type === "MESH3D" && <PanelMesh3dProperties />}


      {type === "ZONE" && <PanelZoneProperties />}

      {type === "BUSINESS_OBJECT" && <PanelBusinessObjectProperties />}

      {type === "WORK_PACKAGE" && <PanelWorkPackageProperties />}

      {/* listingById when a LISTING is selected (back arrow), the module's
          active listing otherwise (no-selection default). Not `listing`: once
          deleted the id no longer resolves and the panel renders nothing. */}
      {type === "BUSINESS_OBJECT_LISTING" && (
        <PanelBusinessObjectListingProperties
          listing={selectionListingId ? listingById : businessObjectsListingById}
        />
      )}

      {type === "PROCEDURE" && <PanelProcedureProperties />}

      {type === "PHOTO" && <PanelPhotoProperties />}

      {type === "POV" && <PanelPovProperties />}

      {type === "POV_FRAME" && <PanelPovFrameProperties />}
    </BoxFlexVStretch>
  );
}
