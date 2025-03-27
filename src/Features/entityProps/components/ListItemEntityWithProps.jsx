import {useSelector} from "react-redux";

import {
  ListItem,
  ListItemButton,
  Checkbox,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

export default function ListItemEntityWithProps({
  entityWithProps,
  selected,
  onClick,
}) {
  // data

  const multiSelect = useSelector((s) => s.entityProps.multiSelect);

  // helpers

  const entityLabel = entityWithProps.label;
  const propsLabel = entityWithProps.propsLabel;

  // handlers

  function handleClick() {
    onClick(entityWithProps);
  }

  return (
    <ListItem
      disablePadding
      divider
      secondaryAction={<Typography variant="caption">{propsLabel}</Typography>}
    >
      <ListItemButton onClick={handleClick} selected={selected}>
        {multiSelect && (
          <ListItemIcon>
            <Checkbox
              size="small"
              edge="start"
              checked={selected}
              tabIndex={-1}
              disableRipple
            />
          </ListItemIcon>
        )}
        <ListItemText primary={entityLabel} />
      </ListItemButton>
    </ListItem>
  );
}
