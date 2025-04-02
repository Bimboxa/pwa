import {
  ListItemText,
  List,
  ListItemButton,
  ListItemIcon,
  Avatar,
} from "@mui/material";
import {Add} from "@mui/icons-material";

export default function ListMaps({maps, onClick, onCreateClick, selection}) {
  // helper

  const canCreate = Boolean(onCreateClick);
  return (
    <List dense>
      {maps?.map((map) => (
        <ListItemButton
          selected={selection?.includes(map.id)}
          key={map.id}
          onClick={() => onClick(map)}
          divider
        >
          <ListItemIcon>
            <Avatar src={map?.image?.imageUrlClient} />
          </ListItemIcon>
          <ListItemText primary={map.label} />
        </ListItemButton>
      ))}
      {canCreate && (
        <ListItemButton onClick={onCreateClick} divider>
          <ListItemIcon>
            <Add />
          </ListItemIcon>
          <ListItemText primary="Créer un nouveau plan" />
        </ListItemButton>
      )}
    </List>
  );
}
