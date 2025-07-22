import { Box, Typography } from "@mui/material";

import PageGeneric from "Features/layout/components/PageGeneric";
import AuthButtons from "Features/auth/components/AuthButtons";

import MainGoogleMapEditor from "Features/gmap/components/MainGoogleMapEditor";

export default function PageDashboard() {
  return (
    <PageGeneric>
      <Box sx={{ position: "absolute", top: "8px", right: "8px", zIndex: 10 }}>
        <AuthButtons />
      </Box>
      <MainGoogleMapEditor />
    </PageGeneric>
  );
}
