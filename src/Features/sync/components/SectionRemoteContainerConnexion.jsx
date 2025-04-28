import {Box, Typography} from "@mui/material";
import ButtonLogoutRemoteContainer from "./ButtonLogoutRemoteContainer";
import SectionSyncFilesToPush from "./SectionSyncFilesToPush";
import ButtonDownloadScope from "./ButtonDownloadScope";
import ButtonUploadScope from "./ButtonUploadScope";

export default function SectionRemoteContainerConnexion({onDisconnexion}) {
  // strings

  const connectedS = "Service connecté";

  // handlers
  return (
    <Box>
      <ButtonDownloadScope />
      <ButtonUploadScope />
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
