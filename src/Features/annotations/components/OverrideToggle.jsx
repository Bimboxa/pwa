import { IconButton } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

export default function OverrideToggle({ field, overrideFields, onToggle }) {
  const isOverridden =
    Array.isArray(overrideFields) && overrideFields.includes(field);

  return (
    <IconButton
      size="small"
      onClick={() => onToggle(field)}
      sx={{
        mr: 0.5,
        color: isOverridden ? "primary.main" : "text.disabled",
        p: 0.25,
      }}
    >
      {isOverridden ? (
        <LockIcon sx={{ fontSize: 16 }} />
      ) : (
        <LockOpenIcon sx={{ fontSize: 16 }} />
      )}
    </IconButton>
  );
}
