import {useEffect, useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import useFetchRemoteProjectScopes from "Features/sync/hooks/useFetchRemoteProjectScopes";

import {setPage} from "../scopeSelectorSlice";

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

  // state

  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState([]);

  console.log("[debug] scopes", scopes);

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

  function handleScopeClick(scope) {
    console.log("scope", scope);
  }

  function handleNewScopeClick() {
    setOpen(true);
  }

  return (
    <>
      <Box sx={{width: 1}}>
        <HeaderVariantBackTitle title={title} onBackClick={handleBackClick} />
        <BlockRemoteProjectContainer remoteProject={remoteProject} />
        <ListScopes
          scopes={scopes}
          onClick={handleScopeClick}
          onNewClick={handleNewScopeClick}
        />
      </Box>
      <DialogCreateScope
        project={remoteProject}
        open={open}
        onClose={() => setOpen(false)}
        createRemote={true}
      />
    </>
  );
}
