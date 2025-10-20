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
  divider,
  selection,
  onClick,
  keyString = "id",
  noItemLabel = "Liste vide",
  componentListItem,
}) {
  // edge case

  console.log("debug_2010_ListItemsGenericV2", items);

  if (!items || items?.length === 0) {
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
          divider={divider}
        >
          {componentListItem &&
            React.createElement(componentListItem, { ...item })}
        </ListItemButton>
      ))}
    </List>
  );
}
