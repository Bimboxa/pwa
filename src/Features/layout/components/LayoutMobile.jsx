import {useSelector} from "react-redux";

import BoxFlexV from "./BoxFlexV";
import TopBar from "./TopBar";
import SectionViewer from "./SectionViewer";
import BottomBarMobile from "./BottomBarMobile";
import MainListPanel from "Features/listPanel/components/MainListPanel";

export default function LayoutMobile() {
  // data

  const viewModeInMobile = useSelector((s) => s.layout.viewModeInMobile);

  return (
    <BoxFlexV>
      <TopBar />
      <BoxFlexV>
        {viewModeInMobile === "MAP" && <SectionViewer />}
        {viewModeInMobile === "LIST" && <MainListPanel />}
      </BoxFlexV>
      <BottomBarMobile />
    </BoxFlexV>
  );
}
