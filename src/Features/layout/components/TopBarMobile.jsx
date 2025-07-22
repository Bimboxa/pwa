import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import AuthButtons from "Features/auth/components/AuthButtons";

export default function TopBarMobile() {
  const height = useSelector((s) => s.layout.topBarHeight);
  return (
    <Box
      sx={{
        width: 1,
        px: 1,
        height,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: "white",
      }}
    >
      <ButtonSelectorScopeInTopBar />

      <AuthButtons />
    </Box>
  );
}
