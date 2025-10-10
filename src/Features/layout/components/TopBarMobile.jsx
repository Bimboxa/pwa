import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
//import AuthButtons from "Features/auth/components/AuthButtons";
import TopBarBreadcrumbs from "./TopBarBreadcrumbs";

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
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <TopBarBreadcrumbs />
      {/* <ButtonSelectorScopeInTopBar /> */}

      {/* <AuthButtons /> */}
    </Box>
  );
}
