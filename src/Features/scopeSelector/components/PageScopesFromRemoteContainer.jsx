import {useEffect, useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import useFetchRemoteProjectScopes from "Features/sync/hooks/useFetchRemoteProjectScopes";
import useSelectRemoteScope from "../hooks/useSelectRemoteScope";
import useSelectRemoteProject from "../hooks/useSelectRemoteProject";

import {setPage, setOpen as setOpenPanel} from "../scopeSelectorSlice";
import {setSelectedScopeId} from "Features/scopes/scopesSlice";
import {setSelectedProjectId} from "Features/projects/projectsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {Box} from "@mui/material";
import HeaderVariantBackTitle from "Features/layout/components/HeaderVariantBackTitle";
import ListScopes from "Features/scopes/components/ListScopes";
import DialogCreateScope from "Features/scopes/components/DialogCreateScope";
import BlockRemoteProjectContainer from "Features/sync/components/BlockRemoteProjectContainer";

export default function PageScopesFromRemoteContainer() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const remoteProject = useSelector((s) => s.scopeSelector.remoteProject);

  // data - func

  const fetchRemoteProjectScopes = useFetchRemoteProjectScopes();
  const selectRemoteScope = useSelectRemoteScope();
  const selectRemoteProject = useSelectRemoteProject();

  // state

  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState([]);

  console.log("[debug] scopes", scopes);
  console.log("[debug] remoteProject", remoteProject);

  // effect - loading

  const fetchAsync = async () => {
    const scopes = await fetchRemoteProjectScopes({project: remoteProject});
    setScopes(scopes);
  };

  useEffect(() => {
    if (remoteProject) {
      fetchAsync();
    }
  }, [remoteProject?.id]);

  // helpers

  const title = appConfig?.strings?.scope?.namePlural;

  // handler

  function handleBackClick() {
    dispatch(setPage("PROJECTS_FROM_REMOTE_CONTAINER"));
  }

  async function handleScopeClick(scope) {
    try {
      console.log("[click] remoteScope", scope);
      await selectRemoteScope(scope);
      dispatch(setPage("PROJECT_AND_SCOPE"));
      dispatch(setOpenPanel(false));
    } catch (error) {
      console.log("error", error);
    }
  }

  function handleNewScopeClick() {
    setOpen(true);
  }

  async function handleScopeCreated(scope) {
    await selectRemoteScope(scope);
    //
    dispatch(setPage("PROJECT_AND_SCOPE"));
    setOpen(false);
    //selectRemoteProject(remoteProject);

    dispatch(setSelectedScopeId(scope.id));
    dispatch(setOpenPanel(false));
  }

  return (
    <>
      <Box sx={{width: 1}}>
        <HeaderVariantBackTitle title={title} onBackClick={handleBackClick} />
        <BlockRemoteProjectContainer remoteProject={remoteProject} />
        <Box sx={{bgcolor: "white"}}>
          <ListScopes
            scopes={scopes}
            onClick={handleScopeClick}
            onNewClick={handleNewScopeClick}
          />
        </Box>
      </Box>
      {open && (
        <DialogCreateScope
          project={remoteProject}
          open={open}
          onClose={() => setOpen(false)}
          onCreated={handleScopeCreated}
        />
      )}
    </>
  );
}
