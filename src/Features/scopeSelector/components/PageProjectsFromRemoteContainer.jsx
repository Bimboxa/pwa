import {useEffect, useState} from "react";
import {useDispatch} from "react-redux";

import {
  setPage,
  setRemoteOpenedProjects,
  setRemoteProject,
} from "../scopeSelectorSlice";

import useProjectsFoldersFromDropbox from "Features/dropbox/hooks/useProjectsFoldersFromDropbox";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
import useRemoteOpenedProjects from "../hooks/useRemoteOpenedProjects";

import {Box, Typography} from "@mui/material";

import ListFolders from "Features/dropbox/components/ListFolders";
import PageProjectsFromRemoteContainersHeader from "./PageProjectsFromRemoteContainersHeader";
import HeaderVariantBackTitle from "Features/layout/components/HeaderVariantBackTitle";
import useFetchRemoteOpenedProjects from "Features/sync/hooks/useFetchRemoteOpenedProjects";
import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";
import ListRemoteItems from "Features/sync/components/ListRemoteItems";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function PageProjectsFromRemoteContainer() {
  const dispatch = useDispatch();
  const appConfig = useAppConfig();

  // strings

  const title = appConfig?.strings?.project?.namePlural;

  // data

  const remoteProjects = useRemoteOpenedProjects();
  const remoteContainer = useRemoteContainer();
  const fetchProjects = useFetchRemoteOpenedProjects();

  // state

  const [loading, setLoading] = useState(false);
  // effect

  const canFetch = Boolean(fetchProjects);

  const fetchAsync = async () => {
    setLoading(true);
    const projects = await fetchProjects();
    console.log("[FETCH] remote projects", projects);
    dispatch(setRemoteOpenedProjects(projects));
    setLoading(false);
  };

  useEffect(() => {
    if (canFetch) fetchAsync();
  }, [canFetch]);

  // handlers

  function handleBackClick() {
    dispatch(setPage("PROJECTS"));
  }

  async function handleRemoteProjectClick(remoteItem) {
    console.log("[PageProjects] remoteProject", remoteItem);
    //
    dispatch(setPage("SCOPES_FROM_REMOTE_CONTAINER"));
    dispatch(setRemoteProject(remoteItem));

    // we create the project in the store if it doesn't exist yet.
  }

  // helpers

  const isDropbox = remoteContainer?.service === "DROPBOX";

  return (
    <Box sx={{width: 1, bgcolor: "background.default"}}>
      <HeaderVariantBackTitle title={title} onBackClick={handleBackClick} />
      {isDropbox && <PageProjectsFromRemoteContainersHeader />}
      {/* <Box sx={{p: 1}}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box> */}
      <Box sx={{bgcolor: "common.white"}}>
        <ListRemoteItems
          loading={loading}
          items={remoteProjects}
          itemType="PROJECT"
          onClick={handleRemoteProjectClick}
        />
      </Box>
    </Box>
  );
}
