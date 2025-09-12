import { Box, List, ListItemButton, ListItemText } from "@mui/material";

export default function ListItemsGeneric({
  items,
  onClick,
  keyString = "id",
  selection,
  onSortEnd,
}) {
  // edge case

  if (!items || items.length === 0) {
    return <Box />;
  }

  return (
    <List dense>
      {items.map((item) => (
        <ListItemButton
          divider
          selected={selection?.includes(item.id)}
          key={item[keyString]}
          onClick={() => onClick(item)}
        >
          <ListItemText>{item.label}</ListItemText>
        </ListItemButton>
      ))}
    </List>
  );
}
