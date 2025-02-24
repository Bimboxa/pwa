import {Box} from "@mui/material";

import BoxFlexV from "./BoxFlexV";

import TopBar from "./TopBar";
import MainListPanel from "Features/listPanel/components/MainListPanel";

export default function LayoutMobile() {
  return (
    <BoxFlexV>
      <TopBar />
      <Box sx={{width: 1, flexGrow: 1, display: "flex", overflow: "auto"}}>
        <MainListPanel />
      </Box>
    </BoxFlexV>
  );
}
