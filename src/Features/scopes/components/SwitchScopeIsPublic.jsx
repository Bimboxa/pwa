import { Box, Switch, Typography } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// isPublic switch — only the creator can toggle it.
export default function SwitchScopeIsPublic({ scope, isCreator }) {
  // strings

  const appConfig = useAppConfig();
  const isPublicLabel =
    appConfig?.strings?.scope?.isPublicLabel ?? "Plan de repérage public";

  // data

  const updateScope = useUpdateScope();

  // render

  if (!scope) return null;

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2">{isPublicLabel}</Typography>
        <Switch
          size="small"
          checked={scope.isPublic === true}
          disabled={!isCreator}
          onChange={(e) =>
            updateScope({
              id: scope.id,
              isPublic: e.target.checked,
            })
          }
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
