import {List, ListItemButton, ListItemText, ListItemIcon} from "@mui/material";
import {Add} from "@mui/icons-material";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function ListScopes({scopes, selection, onClick, onNewClick}) {
  const appConfig = useAppConfig();
  const addS = appConfig?.strings?.scope?.new;
  const addDescriptionS = appConfig?.strings?.scope?.create;

  const refLabelS = "Réf.";

  return (
    <List dense>
      {scopes?.map((scope) => {
        const selected = selection.includes(scope.id);
        const refLabel = scope?.clientRef
          ? `${refLabelS} ${scope.clientRef}`
          : null;
        return (
          <ListItemButton
            divider
            selected={selected}
            key={scope.id}
            onClick={() => onClick(scope)}
          >
            <ListItemText primary={scope.name} secondary={refLabel} />
          </ListItemButton>
        );
      })}
      {onNewClick && (
        <ListItemButton onClick={onNewClick}>
          <ListItemIcon>
            <Add />
          </ListItemIcon>
          <ListItemText primary={addS} secondary={addDescriptionS} />
        </ListItemButton>
      )}
    </List>
  );
}
