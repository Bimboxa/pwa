import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from "@mui/material";

export default function ListViewers({viewers, selectedKey, onClick}) {
  // helpers

  const items = viewers.map((viewer) => ({
    ...viewer,
    selected: selectedKey === viewer.key,
  }));

  // handlers

  function handleClick(viewer) {
    onClick(viewer);
  }
  return (
    <List>
      {items.map((item) => {
        return (
          <ListItemButton
            key={item.key}
            selected={item.selected}
            onClick={() => handleClick(item)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}
