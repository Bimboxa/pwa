import {
  ListItemText,
  List,
  ListItemButton,
  ListItemIcon,
  Avatar,
} from "@mui/material";
import { Add } from "@mui/icons-material";

export default function ListBaseMaps({
  baseMaps,
  onClick,
  onCreateClick,
  selection,
}) {
  // helper

  const canCreate = Boolean(onCreateClick);
  return (
    <List dense>
      {baseMaps?.map((baseMap) => (
        <ListItemButton
          selected={selection?.includes(baseMap.id)}
          key={baseMap.id}
          onClick={() => onClick(baseMap)}
          divider
        >
          <ListItemIcon>
            <Avatar src={baseMap?.image?.imageUrlClient} />
          </ListItemIcon>
          <ListItemText primary={baseMap.label} />
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
