import {useState, useEffect} from "react";
import {createPortal} from "react-dom";

import {useDispatch} from "react-redux";
import {setProject, setScope} from "../scopeSelectorSlice";
import {setSelectedProjectId} from "Features/projects/projectsSlice";
import {setSelectedScopeId} from "Features/scopes/scopesSlice";
import useActionsFromSelectedProjectAndScope from "../hooks/useActionsFromSelectedProjectAndScope";

import {useSelector} from "react-redux";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateScope from "Features/scopes/hooks/useCreateScope";
import useCreateRemoteScope from "Features/sync/hooks/useCreateRemoteScope";
import useCreateRemoteProject from "Features/sync/hooks/useCreateRemoteProject";

import {Box} from "@mui/material";
import ScreenGeneric from "Features/layout/components/ScreenGeneric";
import getActionsFromSelectedProjectAndScope from "../services/getActionsFromSelectedProjectAndScopeService";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import ContainerProjectAndScope from "./ContainerProjectAndScope";

export default function PanelSelectProjectAndScopeLoadingScreen({
  containerEl,
  onLoaded,
}) {
  const dispatch = useDispatch();

  // data

  const selectedProject = useSelector((s) => s.scopeSelector.project);
  const selectedScope = useSelector((s) => s.scopeSelector.scope);

  // data - actions

  const createRemoteProject = useCreateRemoteProject();
  const createProject = useCreateProject();
  const createRemoteScope = useCreateRemoteScope();
  const createScope = useCreateScope();

  // helpers

  const actions = useActionsFromSelectedProjectAndScope({
    project: selectedProject,
    scope: selectedScope,
  });

  // state

  const openLoadingScreen = Boolean(selectedScope?.id);
  const [open, setOpen] = useState(openLoadingScreen);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (openLoadingScreen) {
      setOpen(true);
    }
  }, [selectedProject?.id, selectedScope?.id]);

  // helpers

  const createLabel =
    actions?.scope?.CREATE || actions?.scope?.SYNC ? "Créer" : "Ouvrir";

  // handlers

  function handleClose() {
    dispatch(setProject(null));
    dispatch(setScope(null));
    setOpen(false);
  }

  async function handleCreateAndSelect() {
    setLoading(true);
    try {
      // project
      if (actions?.project?.CREATE) {
        await createProject(selectedProject);
      } else if (actions?.project?.SYNC) {
        await createRemoteProject(selectedProject);
      }

      // scope
      if (actions?.scope?.CREATE) {
        await createScope(selectedScope);
      } else if (actions?.scope?.SYNC) {
        await createRemoteScope(selectedScope);
      }

      // onLoaded
      onLoaded({scope: selectedScope});
    } catch (e) {
      console.log("error", e);
      setLoading(false);
    }
  }

  return createPortal(
    <ScreenGeneric
      open={open}
      onClose={handleClose}
      sx={{
        position: "absolute",
        bgcolor: "white",
        zIndex: 100,
      }}
    >
      <BoxFlexVStretch>
        <Box sx={{flexGrow: 1}}>
          <ContainerProjectAndScope
            project={selectedProject}
            scope={selectedScope}
          />
        </Box>
        <ButtonInPanel
          label={createLabel}
          onClick={handleCreateAndSelect}
          loading={loading}
        />
      </BoxFlexVStretch>
    </ScreenGeneric>,
    containerEl
  );
}
