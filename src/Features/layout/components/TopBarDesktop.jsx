import { useSelector } from "react-redux";

import { Box, Divider } from "@mui/material";

import BoxFlexH from "Features/layout/components/BoxFlexH";
//import SelectorProject from "Features/projectSelector/components/SelectorProject";
import ButtonSelectorProject from "Features/projects/components/ButtonSelectorProject";
import ButtonSelectorScope from "Features/scopes/components/ButtonSelectorScope";
import SelectorViewer from "Features/viewers/components/SelectorViewer";
//import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import AuthButtons from "Features/auth/components/AuthButtons";

export default function TopBarDesktop() {
  const height = useSelector((s) => s.layout.topBarHeight);
  return (
    <Box
      sx={{
        width: 1,
        height,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: "white",
        zIndex: 1000,
        px: 1,
      }}
    >
      {/* <ButtonSelectorScopeInTopBar /> */}
      <BoxFlexH>
        <ButtonSelectorProject />
        <Box sx={{ px: 1 }}>
          <Divider orientation="vertical" flexItem sx={{ height: 24 }} />
        </Box>
        <ButtonSelectorScope />
      </BoxFlexH>

      <Box />

      <SelectorViewer />

      <AuthButtons />
    </Box>
  );
}
