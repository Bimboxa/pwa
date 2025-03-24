import {ListItem, ListItemButton, ListItemText} from "@mui/material";

export default function ListItemEntityVariantDefault({
  entity,
  onClick,
  selection,
}) {
  // helpers

  const label = entity.label;
  const isSelected = selection?.includes(entity.id);

  // handlers

  function handleClick() {
    if (onClick) onClick(entity);
  }
  return (
    <ListItem divider disablePadding>
      <ListItemButton onClick={handleClick} selected={isSelected}>
        <ListItemText>{label}</ListItemText>
      </ListItemButton>
    </ListItem>
  );
}
