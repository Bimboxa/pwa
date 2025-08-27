import React from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

export default function ListItemsGenericV2({
  items,
  selection,
  onClick,
  keyString = "id",
  noItemLabel = "Liste vide",
  componentListItem,
}) {
  // edge case

  if (!items || items.length === 0) {
    return (
      <Box sx={{ width: 1, justifyContent: "center", display: "flex", p: 2 }}>
        <Typography color="text.secondary">{noItemLabel}</Typography>
      </Box>
    );
  }

  return (
    <List dense>
      {items.map((item) => (
        <ListItemButton
          disableRipple
          selected={selection?.includes(item.id)}
          key={item[keyString]}
          onClick={() => onClick(item)}
        >
          {componentListItem &&
            React.createElement(componentListItem, { ...item })}
        </ListItemButton>
      ))}
    </List>
  );
}
