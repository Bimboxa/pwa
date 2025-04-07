import {useEffect} from "react";
import {useDispatch} from "react-redux";

import {setPage} from "../scopeSelectorSlice";

import useProjectsFoldersFromDropbox from "Features/dropbox/hooks/useProjectsFoldersFromDropbox";
import useFetchProjectsFolders from "Features/dropbox/hooks/useFetchProjectsFolders";

import {Box, Typography} from "@mui/material";

import ListFolders from "Features/dropbox/components/ListFolders";
import PageProjectsFromRemoteContainersHeader from "./PageProjectsFromRemoteContainersHeader";
import HeaderVariantBackTitle from "Features/layout/components/HeaderVariantBackTitle";

export default function PageProjectsFromRemoteContainer({remoteContainer}) {
  const dispatch = useDispatch();

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

  // handlers

  function handleBackClick() {
    dispatch(setPage("PROJECTS"));
  }

  function handleRemoteProjectClick(folder) {
    console.log("folder", folder);
    dispatch(setPage("SCOPES_FROM_REMOTE_CONTAINER"));
  }

  // helpers

  const isDropbox = remoteContainer?.service === "DROPBOX";

  return (
    <Box sx={{width: 1, bgcolor: "background.default"}}>
      <HeaderVariantBackTitle title={title} onBackClick={handleBackClick} />
      {isDropbox && <PageProjectsFromRemoteContainersHeader />}
      <Box sx={{p: 1}}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <Box sx={{bgcolor: "common.white"}}>
        <ListFolders
          folders={projectsFolders}
          onClick={handleRemoteProjectClick}
        />
      </Box>
    </Box>
  );
}
