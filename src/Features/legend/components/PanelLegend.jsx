import { Typography } from "@mui/material";

import Panel from "Features/layout/components/Panel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionLegendItems from "./SectionLegendItems";

export default function PanelLegend() {
  // strings

  const title = "Legende";

  return (
    <Panel>
      <Typography sx={{ p: 0.5, fontWeight: "bold" }} variant="caption">
        {title}
      </Typography>
      <BoxFlexVStretch sx={{ p: 1 }}>
        <SectionLegendItems />
      </BoxFlexVStretch>
    </Panel>
  );
}
