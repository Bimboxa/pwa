import { useDispatch, useSelector } from "react-redux";

import { setOpenedPanel } from "../listingsSlice";

import useSelectedListing from "../hooks/useSelectedListing";
import useAutoShowPanelSelectorPresetListings from "../hooks/useAutoShowPanelSelectorPresetListings";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import PanelListing from "./PanelListing";
import PanelSelectorListing from "./PanelSelectorListing";
//import PanelCreateListingEntity from "Features/entities/components/PanelCreateListingEntity";
import PanelEditEntity from "Features/entities/components/PanelEditEntity";
import PanelListingAnnotationTemplates from "Features/annotations/components/PanelListingAnnotationTemplates";
import PanelSelectorListingsOnboarding from "./PanelSelectorListingsOnboarding";
import PanelFormatBgImage from "Features/bgImage/components/PanelFormatBgImage";
import PanelCreateBlueprint from "Features/blueprints/components/PanelCreateBlueprint";
import PanelEditBlueprint from "Features/blueprints/components/PanelEditBlueprint";
import PanelCreateLocatedEntity from "Features/locatedEntities/components/PanelCreateLocatedEntity";
import PanelHelperDrawAnnotation from "Features/annotations/components/PanelHelperDrawAnnotation";
import PanelCreateBaseMap from "Features/baseMaps/components/PanelCreateBaseMap";

export default function PanelListingContainer() {
  const dispatch = useDispatch();

  // data

  const { value: listing } = useSelectedListing();
  let openedPanel = useSelector((s) => s.listings.openedPanel);
  //const showSelectorPresetListings = useAutoShowPanelSelectorPresetListings();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  //if (showSelectorPresetListings) openedPanel = "PRESET_LISTINGS_ONBOARDING";
  if (enabledDrawingMode) openedPanel = "DRAW_ANNOTATION";

  // handlers

  function handleSelectListing(listing) {
    console.log("[PanelListingContainer] handleSelectListing", listing);
    dispatch(setOpenedPanel("LISTING"));
  }

  // render

  return (
    <BoxFlexVStretch
      sx={{ borderRight: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      {openedPanel === "LISTING_SELECTOR" && (
        <PanelSelectorListing
          selectedListingId={listing?.id}
          //onListingSelected={handleSelectListing}
        />
      )}

      {openedPanel === "BG_IMAGE_FORMAT" && <PanelFormatBgImage />}
      {openedPanel === "LISTING" && <PanelListing listing={listing} />}
      {openedPanel === "NEW_ENTITY" && <PanelEditEntity />}
      {openedPanel === "EDITED_ENTITY" && <PanelEditEntity />}
      {openedPanel === "PRESET_LISTINGS_ONBOARDING" && (
        <PanelSelectorListingsOnboarding />
      )}
      {openedPanel === "LISTING_ANNOTATION_TEMPLATES" && (
        <PanelListingAnnotationTemplates />
      )}
      {openedPanel === "NEW_BASE_MAP" && <PanelCreateBaseMap />}
      {openedPanel === "NEW_BLUEPRINT" && <PanelCreateBlueprint />}
      {openedPanel === "EDITED_BLUEPRINT" && <PanelEditBlueprint />}
      {openedPanel === "NEW_LOCATED_ENTITY" && <PanelCreateLocatedEntity />}
      {openedPanel === "DRAW_ANNOTATION" && <PanelHelperDrawAnnotation />}
    </BoxFlexVStretch>
  );
}
