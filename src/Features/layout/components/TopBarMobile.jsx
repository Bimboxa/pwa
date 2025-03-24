import {Box} from "@mui/material";

import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import {AuthButtons} from "Features/auth/components/AuthButtons";

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
      <ButtonSelectorScopeInTopBar />

      <AuthButtons />
    </Box>
  );
}
