import {useSelector} from "react-redux";

import {Box} from "@mui/material";

import SelectorViewer from "Features/viewers/components/SelectorViewer";
import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import {AuthButtons} from "Features/auth/components/AuthButtons";

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
      <ButtonSelectorScopeInTopBar />
      <Box />

      <SelectorViewer />

      <AuthButtons />
    </Box>
  );
}
