import {ListItemText, List, ListItemButton} from "@mui/material";

export default function ListMaps({maps, onClick}) {
  return (
    <List>
      {maps.map((map) => (
        <ListItemButton key={map.id} onClick={() => onClick(map)}>
          {map.thumbnail && (
            <img src={map.thumbnail} alt={map.name} style={{height: 50}} />
          )}
          <ListItemText primary={map.name} />
        </ListItemButton>
      ))}
    </List>
  );
}
