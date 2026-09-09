import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { Check } from "@mui/icons-material";

// Radio-like option list (Krnet "Option" rows): label + optional
// description, a check icon on the active one(s). `values` (array) turns
// it into a multi-select.
export default function ListOptionsSelectable({
  options,
  value,
  values,
  onSelect,
  disabled,
  emptyHint,
}) {
  const isMulti = Array.isArray(values);
  const isActive = (v) => (isMulti ? values.includes(v) : v === value);

  if (!options?.length) {
    return emptyHint ? (
      <Typography variant="caption" color="text.disabled">
        {emptyHint}
      </Typography>
    ) : null;
  }

  return (
    <List dense disablePadding sx={{ mx: -1 }}>
      {options.map((opt) => (
        <ListItemButton
          key={opt.value}
          selected={isActive(opt.value)}
          disabled={disabled}
          onClick={() => onSelect(opt.value)}
          sx={{ py: 0.5 }}
        >
          <ListItemText
            primary={opt.label}
            secondary={opt.desc}
            slotProps={{
              primary: { variant: "body2", noWrap: true },
              secondary: { variant: "caption" },
            }}
          />
          {isActive(opt.value) && (
            <ListItemIcon sx={{ minWidth: 0, ml: 1 }}>
              <Check fontSize="small" color="primary" />
            </ListItemIcon>
          )}
        </ListItemButton>
      ))}
    </List>
  );
}
