import {Box} from "@mui/material";

import IconButtonInitiateConnection from "Features/webrtc/components/IconButtonInitiateConnection";
import SelectorViewer from "Features/viewers/components/SelectorViewer";
import BlockProjectInTopBar from "Features/projects/components/BlockProjectInTopBar";
import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import {AuthButtons} from "Features/auth/components/AuthButtons";

export default function TopBarDesktop() {
  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: "white",
        zIndex: 1000,
      }}
    >
      {/* <BlockProjectInTopBar /> */}
      <ButtonSelectorScopeInTopBar />

      <SelectorViewer />

      {/* <IconButtonInitiateConnection /> */}
      <AuthButtons />
    </Box>
  );
}
