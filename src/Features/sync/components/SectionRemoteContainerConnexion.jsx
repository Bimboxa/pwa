import {Box, Typography} from "@mui/material";
import ButtonLogoutRemoteContainer from "./ButtonLogoutRemoteContainer";
import SectionSyncFilesToPush from "./SectionSyncFilesToPush";

export default function SectionRemoteContainerConnexion({
  remoteContainer,
  onDisconnexion,
}) {
  // strings

  const connectedS = "Service connecté";

  // handlers
  return (
    <Box>
      <Box sx={{p: 2}}>
        <Typography variant="body2" color="text.secondary">
          {connectedS}
        </Typography>
      </Box>
      <SectionSyncFilesToPush />
      <ButtonLogoutRemoteContainer onDisconnexion={onDisconnexion} />
    </Box>
  );
}
