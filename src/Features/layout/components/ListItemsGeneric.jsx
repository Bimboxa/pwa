import {Box, List, ListItemButton, ListItemText} from "@mui/material";

export default function ListItemsGeneric({items, onClick, keyString}) {
  // edge case

  if (!items || items.length === 0) {
    return <Box />;
  }

  return (
    <List dense>
      {items.map((item) => (
        <ListItemButton key={item[keyString]} onClick={() => onClick(item)}>
          <ListItemText>{item.label}</ListItemText>
        </ListItemButton>
      ))}
    </List>
  );
}
