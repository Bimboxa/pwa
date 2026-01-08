

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListAnnotations from "Features/annotations/components/ListAnnotations";

export default function SectionLocatedEntitiesInListPanelTabAnnotations() {

  // data

  const annotations = useAnnotationsV2({
    withQties: true,
    filterBySelectedListing: true,
    excludeBgAnnotations: true,
    groupByBaseMap: true
  });


  // render

  return <BoxFlexVStretch sx={{ overflowY: "auto", pt: 2 }}>
    <ListAnnotations annotations={annotations} />

  </BoxFlexVStretch>

}
