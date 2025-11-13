import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setOpenSelectorScope } from "../scopesSlice";
import { setSelectedScopeId } from "../scopesSlice";

import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import useScopes from "Features/scopes/hooks/useScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Typography, Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BlockSelectedScope from "Features/scopes/components/BlockSelectedScope";
import SelectorScope from "Features/scopes/components/SelectorScope";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCreateScope from "Features/scopes/components/SectionCreateScope";

export default function DialogSelectorScope() {
  const dispatch = useDispatch();

  // strings

  const createS = "Nouveau";

  // state

  const [openCreateScope, setOpenCreateScope] = useState(false);

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

  function handleCreate() {
    setOpenCreateScope(true);
  }

  function handleScopeCreated(scope) {
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setOpenSelectorScope(false));
    setOpenCreateScope(false);
  }

  // return

  if (openCreateScope) {
    return (
      <DialogGeneric
        open={openCreateScope}
        onClose={() => setOpenCreateScope(false)}
      >
        <SectionCreateScope
          onClose={() => setOpenCreateScope(false)}
          onCreated={handleScopeCreated}
          projectId={projectId}
        />
      </DialogGeneric>
    );
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} width={"350px"}>
      {/* <BlockSelectedScope /> */}

      <HeaderTitleClose title={selectS} onClose={handleClose} />
      <BoxFlexVStretch>
        <SelectorScope
          scopes={scopes}
          selection={selectedScopeId}
          onSelectionChange={handleSelectionChange}
        />
      </BoxFlexVStretch>
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreate}
        variant="outlined"
      />
    </DialogGeneric>
  );
}
