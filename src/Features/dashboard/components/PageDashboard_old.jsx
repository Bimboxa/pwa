import { Box, Typography } from "@mui/material";

import PageGeneric from "Features/layout/components/PageGeneric";
import AuthButtons from "Features/auth/components/AuthButtons";

import MainGoogleMapEditor from "Features/gmap/components/MainGoogleMapEditor";
import LogoApp from "App/components/LogoApp";
import ButtonCreateScope from "Features/scopes/components/ButtonCreateScope";
import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";

export default function PageDashboard() {
  return (
    <PageGeneric>
      <Box
        sx={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 10,
          display: "flex",
        }}
      >
        <LogoApp />
        <ButtonCreateScope />
      </Box>
      <Box sx={{ position: "absolute", top: "8px", right: "8px", zIndex: 10 }}>
        <AuthButtons />
      </Box>
      <MainGoogleMapEditor />
      <DialogAutoScopeCreator />
    </PageGeneric>
  );
}
