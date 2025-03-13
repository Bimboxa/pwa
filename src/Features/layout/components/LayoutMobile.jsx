import BoxFlexV from "./BoxFlexV";
import TopBar from "./TopBar";
import SectionViewer from "./SectionViewer";
import BottomBarMobile from "./BottomBarMobile";

export default function LayoutMobile() {
  return (
    <BoxFlexV>
      <TopBar />
      <BoxFlexV>
        <SectionViewer />
      </BoxFlexV>
      <BottomBarMobile />
    </BoxFlexV>
  );
}
