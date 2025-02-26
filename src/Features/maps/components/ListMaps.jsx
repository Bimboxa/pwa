import {ListItemText, List, ListItemButton} from "@mui/material";

export default function ListMaps({maps, onClick}) {
  return (
    <List>
      {maps.map((map) => (
        <ListItemButton key={map.id} onClick={() => onClick(map)}>
          <ListItemText primary={map.name} />
        </ListItemButton>
      ))}
    </List>
  );
}
