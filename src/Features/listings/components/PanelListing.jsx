import { useDispatch } from "react-redux";

import { setOpenLeftPanel } from "Features/leftPanel/leftPanelSlice";

import { Box, IconButton } from "@mui/material";
import { ArrowBackIos } from "@mui/icons-material";

//import Panel from "Features/layout/components/Panel";
import HeaderListing from "Features/listings/components/HeaderListing";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import VerticalSelectorListing from "Features/listings/components/VerticalSelectorListing";
import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import SectionLegendInListPanel from "Features/legend/components/SectionLegendEntityInListPanel";
import ButtonShowListingAnnotationTemplatesInLeftPanel from "Features/listings/components/ButtonShowListingAnnotationTemplatesInLeftPanel";
import SectionHelperCreateFirstListing from "./SectionHelperCreateFirstListing";

export default function PanelListing({ listing }) {
  const dispatch = useDispatch();

  // helpers

  let type = "DEFAULT";
  if (listing?.entityModel?.type === "LEGEND_ENTITY") type = "LEGEND";

  // render

  if (!listing?.projectId) return <SectionHelperCreateFirstListing />;

  return (
    <BoxFlexVStretch>
      <HeaderListing listing={listing} />

      <BoxFlexVStretch>
        {type === "DEFAULT" && <SectionListEntitiesInListPanel />}
        {type === "LEGEND" && <SectionLegendInListPanel listing={listing} />}
      </BoxFlexVStretch>

      {listing?.annotationTemplatesListingKey && (
        <ButtonShowListingAnnotationTemplatesInLeftPanel />
      )}
    </BoxFlexVStretch>
  );
}
