import {useDispatch} from "react-redux";

import {setPage} from "../scopeSelectorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {Box} from "@mui/material";
import HeaderVariantBackTitle from "Features/layout/components/HeaderVariantBackTitle";
import ListScopes from "Features/scopes/components/ListScopes";

export default function PageScopesFromRemoteContainer() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const scopes = [];

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
    console.log("new scope");
  }

  return (
    <Box sx={{width: 1}}>
      <HeaderVariantBackTitle title={title} onBackClick={handleBackClick} />
      <ListScopes
        scopes={scopes}
        onClick={handleScopeClick}
        onNewClick={handleNewScopeClick}
      />
    </Box>
  );
}
