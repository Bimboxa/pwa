import {Box} from "@mui/material";

import SelectorViewer from "Features/viewers/components/SelectorViewer";
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
      <ButtonSelectorScopeInTopBar />

      <SelectorViewer />

      <AuthButtons />
    </Box>
  );
}
