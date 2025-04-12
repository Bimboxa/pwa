import {useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import {setPage} from "../scopeSelectorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {Box} from "@mui/material";
import HeaderVariantBackTitle from "Features/layout/components/HeaderVariantBackTitle";
import ListScopes from "Features/scopes/components/ListScopes";
import DialogCreateScope from "Features/scopes/components/DialogCreateScope";

export default function PageScopesFromRemoteContainer() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const scopes = [];
  const remoteProjectContainer = useSelector(
    (s) => s.scopeSelector.remoteProjectContainer
  );

  // state

  const [open, setOpen] = useState(false);

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
        <ListScopes
          scopes={scopes}
          onClick={handleScopeClick}
          onNewClick={handleNewScopeClick}
        />
      </Box>
      <DialogCreateScope
        open={open}
        createRemote={true}
        remoteProjectContainer={remoteProjectContainer}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
