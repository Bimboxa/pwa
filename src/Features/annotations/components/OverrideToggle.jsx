import { IconButton } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

export default function OverrideToggle({ field, overrideFields, onToggle, size = 16 }) {
  const isOverridden =
    Array.isArray(overrideFields) && overrideFields.includes(field);

  return (
    <IconButton
      size="small"
      onClick={() => onToggle(field)}
      sx={{
        mr: 0.5,
        color: isOverridden ? "action.active" : "text.disabled",
        p: 0.25,
      }}
    >
      {isOverridden ? (
        <LockIcon sx={{ fontSize: size }} />
      ) : (
        <LockOpenIcon sx={{ fontSize: size }} />
      )}
    </IconButton>
  );
}
