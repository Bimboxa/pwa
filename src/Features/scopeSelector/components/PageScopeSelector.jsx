import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setPage, setOpen} from "../scopeSelectorSlice";
import {setSelectedScopeId} from "Features/scopes/scopesSlice";
import {setSelectedProjectId} from "Features/projects/projectsSlice";

import useScopes from "Features/scopes/hooks/useScopes";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import {Box, List, Typography, IconButton} from "@mui/material";
import {ArrowBackIos as Back} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListScopes from "Features/scopes/components/ListScopes";
import DialogCreateScope from "Features/scopes/components/DialogCreateScope";

export default function PageScopeSelector() {
  const dispatch = useDispatch();

  // strings

  const projectsS = "Dossiers";

  const onDeviceS = "Sur l'appareil";
  const onCloudS = "Télécharger depuis";

  // data

  const project = useSelector((s) => s.scopeSelector.project);

  const {value: scope} = useSelectedScope();
  const {value: scopes} = useScopes({filterByProjectId: project?.id});

  // state

  const [openCreateScope, setOpenCreateScope] = useState(false);
  // helpers

  const selection = scope ? [scope.id] : [];

  // handlers
  function handleBackClick() {
    dispatch(setPage("PROJECTS"));
  }

  function handleScopeClick(scope) {
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setSelectedProjectId(scope.projectId));
    dispatch(setOpen(false));
  }

  function handleNewScopeClick() {
    setOpenCreateScope(true);
  }

  return (
    <>
      <BoxFlexVStretch sx={{bgcolor: "background.default"}}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <IconButton onClick={handleBackClick}>
            <Back />
          </IconButton>
          <Typography
            color="text.secondary"
            variant="body2"
            sx={{fontWeight: "bold"}}
          >
            {project?.name}
          </Typography>
          <Box sx={{width: "24px"}} />
        </Box>
        <Box sx={{p: 1}}>
          <Typography variant="caption" color="text.secondary">
            {onDeviceS}
          </Typography>
        </Box>

        <Box sx={{bgcolor: "white"}}>
          <ListScopes
            scopes={scopes}
            selection={selection}
            onClick={handleScopeClick}
            onNewClick={handleNewScopeClick}
          />
        </Box>

        <Box sx={{p: 1}}>
          <Typography variant="caption" color="text.secondary">
            {onCloudS}
          </Typography>
        </Box>
      </BoxFlexVStretch>

      <DialogCreateScope
        project={project}
        open={openCreateScope}
        onClose={() => setOpenCreateScope(false)}
      />
    </>
  );
}
