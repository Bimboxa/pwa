import React from "react";

import BoxFlexV from "./BoxFlexV";
import BoxFlexVStretch from "./BoxFlexVStretch";
import BoxFlexHStretch from "./BoxFlexHStretch";

import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import ListPanel from "Features/listPanel/components/ListPanel";

export default function LayoutDesktop() {
  return (
    <BoxFlexV sx={{position: "relative"}}>
      <TopBarDesktop />
      <BoxFlexHStretch>
        <ListPanel />

        <SectionViewer />
      </BoxFlexHStretch>
    </BoxFlexV>
  );
}
