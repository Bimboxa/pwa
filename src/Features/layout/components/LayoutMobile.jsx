import { useSelector } from "react-redux";

import { Box } from "@mui/material";
import PanelListItem from "Features/listPanel/components/PanelListItem";

import BoxFlexV from "./BoxFlexV";
import BoxFlexVStretch from "./BoxFlexVStretch";

import TopBar from "./TopBar";
import SectionViewer from "./SectionViewer";
import BottomBarMobile from "./BottomBarMobile";
import ListPanel from "Features/listPanel/components/ListPanel";
import PanelListingContainerWithVerticalSelector from "Features/listings/components/PanelListingContainerWithVerticalSelector";
import PanelChatContainer from "./PanelChatContainer";
import PanelShowable from "./PanelShowable";
import DialogAppConfig from "Features/appConfig/components/DialogAppConfig";

export default function LayoutMobile() {
  console.log("[debug] LayoutMobile");
  // data

  const viewModeInMobile = useSelector((s) => s.layout.viewModeInMobile);

  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);
  const listPanelWidth = useSelector((s) => s.listPanel.width);

  const topBarHeight = useSelector((s) => s.layout.topBarHeight);
  const bottomBarHeight = useSelector((s) => s.layout.bottomBarHeight);

  console.log("bottomBarHeight", bottomBarHeight);

  // helpers

  const showViewer = viewModeInMobile === "MAP";
  const showList = viewModeInMobile === "LIST";

  const transform = openPanelListItem
    ? "translateX(0px)"
    : `translateX(-${listPanelWidth}px)`;

  return (
    <>
      <DialogAppConfig />
      <BoxFlexV>
        <TopBar />
        <BoxFlexVStretch>
          <PanelShowable
            show={showViewer}
            sx={{
              position: "fixed",
              top: topBarHeight,
              bottom: bottomBarHeight,
            }}
            //sx={{position: "absolute", top: 0}}
          >
            <SectionViewer />
          </PanelShowable>
          <PanelShowable
            show={showList}
            sx={{
              position: "fixed",
              top: topBarHeight,
              bottom: bottomBarHeight,
            }}
          >
            <PanelListingContainerWithVerticalSelector />
          </PanelShowable>
        </BoxFlexVStretch>
        <BottomBarMobile />
        <PanelChatContainer />
      </BoxFlexV>
    </>
  );
}
