import {Box} from "@mui/material";

import BlockProjectInTopBar from "Features/projects/components/BlockProjectInTopBar";
import SelectorViewer from "Features/viewers/components/SelectorViewer";
import IconButtonReceivingConnection from "Features/webrtc/components/IconButtonReceivingConnection";

export default function TopBarMobile() {
  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <BlockProjectInTopBar />

      <SelectorViewer />

      <IconButtonReceivingConnection />
    </Box>
  );
}
