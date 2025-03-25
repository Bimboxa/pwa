import {List, ListItemButton, ListItemText, ListItemIcon} from "@mui/material";
import {Add} from "@mui/icons-material";

export default function ListScopes({scopes, selection, onClick, onNewClick}) {
  const addS = "Nouveau lot";
  const addDescriptionS = "Créer un nouveau lot";

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
