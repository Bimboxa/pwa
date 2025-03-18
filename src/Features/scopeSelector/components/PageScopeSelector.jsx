import useScopes from "Features/scopes/hooks/useScopes";
import useScope from "Features/scopes/hooks/useScope";

import {Box, List, Typography} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListScopes from "Features/scopes/components/ListScopes";

export default function PageScopeSelector({onScopeClick}) {
  // strings

  const onDeviceS = "Sur l'appareil";
  const onCloudS = "Télécharger depuis";

  // data

  const scope = useScope();
  const scopes = useScopes();

  // helpers

  const selection = scope ? [scope.id] : [];

  // handlers

  function handleScopeClick(scope) {
    if (onScopeClick) onScopeClick(scope);
  }

  function handleNewScopeClick() {}

  return (
    <BoxFlexVStretch sx={{bgcolor: "background.default"}}>
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
  );
}
