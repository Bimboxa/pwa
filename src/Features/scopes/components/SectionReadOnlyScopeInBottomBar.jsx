import { Box, Typography } from "@mui/material";
import { Lock } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

// Persistent bottom-bar strip shown while the selected scope is read-only
// (private scope created by another user).

export default function SectionReadOnlyScopeInBottomBar() {
  // data

  const appConfig = useAppConfig();
  const { isReadOnly, creatorLabel } = useReadOnlyScope();

  // strings

  const messageS =
    appConfig?.strings?.scope?.readOnlyContactMessage ??
    "Données privées. Pour modifier, contactez : ";

  // render

  if (!isReadOnly) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        bgcolor: "warning.main",
        borderRadius: "0px",
        px: 1,
        flexShrink: 0,
      }}
    >
      <Lock sx={{ fontSize: 14, color: "white" }} />
      <Typography color="white" variant="caption" noWrap>
        {messageS + creatorLabel}
      </Typography>
    </Box>
  );
}
