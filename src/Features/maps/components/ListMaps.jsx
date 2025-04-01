import {ListItemText, List, ListItemButton} from "@mui/material";

export default function ListMaps({maps, onClick, onCreateClick}) {
  // helper

  const canCreate = Boolean(onCreateClick);
  return (
    <List>
      {maps?.map((map) => (
        <ListItemButton key={map.id} onClick={() => onClick(map)}>
          <ListItemText primary={map.name} />
        </ListItemButton>
      ))}
      {canCreate && (
        <ListItemButton onClick={onCreateClick}>
          <ListItemText primary="Créer un nouveau plan" />
        </ListItemButton>
      )}
    </List>
  );
}
