import {useSelector} from "react-redux";

import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Box} from "@mui/material";

import SectionShapesInListPanel from "Features/shapes/components/SectionShapesInListPanel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListPanelHeader from "./ListPanelHeader";
import ListPanelBottom from "./ListPanelBottom";
import PanelListItem from "./PanelListItem";
import ListPanelListItems from "./ListPanelListItems";

export default function ListPanel() {
  // data

  const width = useSelector((s) => s.listPanel.width);
  const open = useSelector((s) => s.listPanel.open);
  const isMobile = useIsMobile();

  // helper

  let computedWidth = open ? width : 0;
  if (isMobile) computedWidth = 1;

  return (
    <Box
      sx={{
        width: computedWidth,
        minWidth: computedWidth, // component lives in a flex container
        height: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.main",
        position: "relative",
      }}
    >
      <ListPanelHeader open={open} />
      <BoxFlexVStretch>
        {/* <SectionShapesInListPanel /> */}
        <ListPanelListItems />
      </BoxFlexVStretch>
      {/* <ListPanelBottom /> */}
      <PanelListItem />
    </Box>
  );
}
