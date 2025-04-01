import {useDispatch} from "react-redux";

import {setPage} from "../scopeSelectorSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import {Box, Typography, Button} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PageProjectAndScope() {
  const dispatch = useDispatch();

  // strings

  const onClientS = "Sur cet appareil";
  const projectS = "Dossier";
  const scopeS = "Lot";
  const seeProjectsS = "Tous les dossiers";
  const seeScopesS = "Tous les lots";
  const clientRefS = "Réf.";

  // data

  const {value: scope} = useSelectedScope({withProject: true});

  // helpers

  const projectName = scope?.project?.name;
  const scopeName = scope?.name ?? "-";

  const projectRefLabel = `${clientRefS} ${scope?.project?.clientRef}`;
  const scopeRefLabel = scope?.clientRef
    ? `${clientRefS} ${scope.clientRef}`
    : null;

  // handlers

  function handleSeeProjectsClick() {
    dispatch(setPage("PROJECTS"));
  }

  function handleSeeScopesClick() {
    dispatch(setPage("SCOPES"));
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{px: 1, bgcolor: "background.default"}}>
        <Typography variant="caption" color="text.secondary">
          {projectS}
        </Typography>
        <Typography>{projectName}</Typography>
        <Typography variant="caption">{projectRefLabel}</Typography>
        <Box sx={{display: "flex", width: 1, justifyContent: "flex-end"}}>
          <Button
            endIcon={<Forward />}
            color="inherit"
            onClick={handleSeeProjectsClick}
          >
            {seeProjectsS}
          </Button>
        </Box>
      </Box>

      <Box sx={{p: 2, bgcolor: "background.default"}}>
        <Box sx={{p: 1, bgcolor: "common.white"}}>
          <Typography variant="caption" color="text.secondary">
            {scopeS}
          </Typography>
          <Typography>{scopeName}</Typography>
          <Typography variant="caption">{scopeRefLabel}</Typography>
          <Box sx={{display: "flex", width: 1, justifyContent: "flex-end"}}>
            <Button endIcon={<Forward />} onClick={handleSeeScopesClick}>
              {seeScopesS}
            </Button>
          </Box>
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
