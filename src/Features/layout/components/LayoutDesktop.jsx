import React from "react";

import BoxFlexV from "./BoxFlexV";
import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import BoxFlexVStretch from "./BoxFlexVStretch";

export default function LayoutDesktop() {
  return (
    <BoxFlexV>
      <TopBarDesktop />
      <BoxFlexVStretch>
        <SectionViewer />
      </BoxFlexVStretch>
    </BoxFlexV>
  );
}
