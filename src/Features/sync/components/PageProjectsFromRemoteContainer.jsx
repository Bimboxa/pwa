import {useEffect} from "react";

import {useDispatch} from "react-redux";

import useProjectsFoldersFromDropbox from "Features/dropbox/hooks/useProjectsFoldersFromDropbox";
import useFetchProjectsFolders from "Features/dropbox/hooks/useFetchProjectsFolders";

import setRemoteProjectContainerProps from "../services/setRemoteProjectContainerProps";
import {setOpenPanelSync} from "../syncSlice";

import {Box, Typography, IconButton} from "@mui/material";
import {Refresh} from "@mui/icons-material";

import ListFolders from "Features/dropbox/components/ListFolders";
import PageProjectsFromRemoteContainersHeader from "./PageProjectsFromRemoteContainersHeader";
import ButtonLogoutDropbox from "Features/dropbox/components/ButtonLogoutDropbox";

export default function PageProjectsFromRemoteContainer({
  remoteContainer,
  onBackClick,
}) {
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

  function handleRefresh() {
    if (canFetch) fetchProjectsFolders();
  }

  function handleFolderClick(folder) {
    console.log("Folder clicked:", folder);
    const remoteProjectContainerProps = {
      type: "DROPBOX_FOLDER",
      dropboxFolder: folder,
    };
    setRemoteProjectContainerProps(remoteProjectContainerProps);
    dispatch(setOpenPanelSync(false));
  }

  // helpers

  const isDropbox = remoteContainer.service === "DROPBOX";

  return (
    <Box sx={{width: 1, bgcolor: "background.default"}}>
      {isDropbox && (
        <PageProjectsFromRemoteContainersHeader onBackClick={onBackClick} />
      )}
      <Box
        sx={{
          p: 1,
          width: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <IconButton onClick={handleRefresh} size="small" color="primary">
          <Refresh fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{bgcolor: "common.white"}}>
        <ListFolders folders={projectsFolders} onClick={handleFolderClick} />
      </Box>

      <Box sx={{p: 1, width: 1, display: "flex", justifyContent: "end"}}>
        <ButtonLogoutDropbox />
      </Box>
    </Box>
  );
}
