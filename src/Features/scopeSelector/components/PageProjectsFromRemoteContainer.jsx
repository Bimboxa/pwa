import useProjectsFoldersFromDropbox from "Features/dropbox/hooks/useProjectsFoldersFromDropbox";

import {Box, Typography} from "@mui/material";

import ListFolders from "Features/dropbox/components/ListFolders";
import ButtonLoginDropbox from "Features/dropbox/components/ButtonLoginDropbox";

export default function PageProjectsFromRemoteContainer({remoteContainer}) {
  // strings

  const title = "Dossiers depuis dropbox";

  // data

  const projectsFolders = useProjectsFoldersFromDropbox();

  // helpers

  const isDropbox = remoteContainer.service === "DROPBOX";

  return (
    <Box sx={{width: 1}}>
      {isDropbox && <ButtonLoginDropbox />}
      <Box sx={{p: 1}}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <ListFolders folders={projectsFolders} />
    </Box>
  );
}
