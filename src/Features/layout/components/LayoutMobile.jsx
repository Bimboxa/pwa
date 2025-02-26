import BoxFlexV from "./BoxFlexV";
import TopBar from "./TopBar";
import SectionViewer from "./SectionViewer";
export default function LayoutMobile() {
  return (
    <BoxFlexV>
      <TopBar />
      <BoxFlexV>
        <SectionViewer />
      </BoxFlexV>
    </BoxFlexV>
  );
}
