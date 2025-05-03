import {Box, ListItemText, List, ListItemButton} from "@mui/material";

export default function FieldOptionVariantMobile({
  value,
  onChange,
  valueOptions,
}) {
  // handlers

  function handleChange(option) {
    onChange(option);
  }

  return (
    <List>
      {valueOptions?.map((option) => {
        const selected = value?.key === option.key;
        return (
          <ListItemButton
            divider
            selected={selected}
            onClick={() => handleChange(option)}
            key={option.key}
          >
            <ListItemText primary={option.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}
