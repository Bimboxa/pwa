import { useSelector, useDispatch } from "react-redux";

import { setOpenSelectorScope } from "../scopesSlice";
import { setSelectedScopeId } from "../scopesSlice";

import useScopes from "Features/scopes/hooks/useScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Typography, Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BlockSelectedScope from "Features/scopes/components/BlockSelectedScope";
import SelectorScope from "Features/scopes/components/SelectorScope";

export default function DialogSelectorScope() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((state) => state.projects.selectedProjectId);
  const open = useSelector((state) => state.scopes.openSelectorScope);
  const { value: scopes } = useScopes({ filterByProjectId: projectId });
  const selectedScopeId = useSelector((state) => state.scopes.selectedScopeId);

  // helpers

  const selectS = appConfig?.strings?.scope?.select;

  // handlers

  function handleClose() {
    dispatch(setOpenSelectorScope(false));
  }

  function handleSelectionChange(scopeId) {
    dispatch(setSelectedScopeId(scopeId));
    dispatch(setOpenSelectorScope(false));
  }

  // return

  return (
    <DialogGeneric open={open} onClose={handleClose} width={"350px"}>
      <BlockSelectedScope />
      <Box sx={{ mt: 2, p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {selectS}
        </Typography>
      </Box>
      <SelectorScope
        scopes={scopes}
        selection={selectedScopeId}
        onSelectionChange={handleSelectionChange}
      />
    </DialogGeneric>
  );
}
