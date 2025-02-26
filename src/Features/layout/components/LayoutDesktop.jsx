import React from "react";

import BoxFlexV from "./BoxFlexV";
import BoxFlexVStretch from "./BoxFlexVStretch";
import BoxFlexHStretch from "./BoxFlexHStretch";

import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import MainListPanel from "Features/listPanel/components/MainListPanel";

export default function LayoutDesktop() {
  return (
    <BoxFlexV sx={{position: "relative"}}>
      <TopBarDesktop />
      <BoxFlexHStretch>
        <MainListPanel />
        <SectionViewer />
      </BoxFlexHStretch>
    </BoxFlexV>
  );
}
