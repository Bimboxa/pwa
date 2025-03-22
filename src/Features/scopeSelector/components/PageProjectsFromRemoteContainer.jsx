import {useEffect} from "react";

import useProjectsFoldersFromDropbox from "Features/dropbox/hooks/useProjectsFoldersFromDropbox";
import useFetchProjectsFolders from "Features/dropbox/hooks/useFetchProjectsFolders";

import {Box, Typography} from "@mui/material";

import ListFolders from "Features/dropbox/components/ListFolders";
import PageProjectsFromRemoteContainersHeader from "./PageProjectsFromRemoteContainersHeader";

export default function PageProjectsFromRemoteContainer({remoteContainer}) {
  // strings

  const title = "Dossiers depuis dropbox";

  // data

  const projectsFolders = useProjectsFoldersFromDropbox();
  const fetchProjectsFolders = useFetchProjectsFolders();

  // effect

  const canFetch = Boolean(fetchProjectsFolders);

  useEffect(() => {
    if (canFetch) fetchProjectsFolders();
  }, [canFetch]);

  // helpers

  const isDropbox = remoteContainer.service === "DROPBOX";

  return (
    <Box sx={{width: 1, bgcolor: "background.default"}}>
      {isDropbox && <PageProjectsFromRemoteContainersHeader />}
      <Box sx={{p: 1}}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <Box sx={{bgcolor: "common.white"}}>
        <ListFolders folders={projectsFolders} />
      </Box>
    </Box>
  );
}
