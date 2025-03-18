import useScope from "Features/scopes/hooks/useScope";
import useScopes from "Features/scopes/hooks/useScopes";

import {Box, Typography, Button} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PageProjectAndScope({
  onSeeProjectsClick,
  onSeeScopesClick,
}) {
  // strings

  const onClientS = "Sur cet appareil";
  const projectS = "Dossier";
  const scopeS = "Lot";
  const seeProjectsS = "Voir tous les dossiers";
  const seeScopesS = "Voir les lots du dossier";
  const clientRefS = "Réf.";

  // data

  const scope = useScope({withProject: true});

  // helpers

  const projectName = scope?.project?.name;
  const scopeName = scope?.name ?? "-";

  const projectRefLabel = `${clientRefS} ${scope?.project?.clientRef}`;
  const scopeRefLabel = scope?.clientRef
    ? `${clientRefS} ${scope.clientRef}`
    : null;

  // handlers

  function handleSeeProjectsClick() {
    if (onSeeProjectsClick) onSeeProjectsClick();
  }

  function handleSeeScopesClick() {
    if (onSeeScopesClick) onSeeScopesClick();
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

      <Box sx={{px: 1, pl: 3}}>
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
    </BoxFlexVStretch>
  );
}
