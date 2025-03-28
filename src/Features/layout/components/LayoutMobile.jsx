import {useSelector} from "react-redux";

import BoxFlexV from "./BoxFlexV";
import TopBar from "./TopBar";
import SectionViewer from "./SectionViewer";
import BottomBarMobile from "./BottomBarMobile";
import ListPanel from "Features/listPanel/components/ListPanel";
import PanelChatContainer from "./PanelChatContainer";

export default function LayoutMobile() {
  // data

  const viewModeInMobile = useSelector((s) => s.layout.viewModeInMobile);

  return (
    <BoxFlexV>
      <TopBar />
      <BoxFlexV>
        {viewModeInMobile === "MAP" && <SectionViewer />}
        {viewModeInMobile === "LIST" && <ListPanel />}
      </BoxFlexV>
      <BottomBarMobile />
      <PanelChatContainer />
    </BoxFlexV>
  );
}
