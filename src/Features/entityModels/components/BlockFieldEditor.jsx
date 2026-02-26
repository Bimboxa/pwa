import { Box, IconButton, MenuItem, TextField } from "@mui/material";
import { Delete } from "@mui/icons-material";

const FIELD_TYPES = [
  "text",
  "image",
  "color",
  "check",
  "option",
  "optionKey",
  "number",
  "slider",
];

export default function BlockFieldEditor({ field, onChange, onDelete }) {
  // handlers

  function handleChange(prop, value) {
    onChange({ ...field, [prop]: value });
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "center",
        p: 0.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <TextField
        value={field.key ?? ""}
        onChange={(e) => handleChange("key", e.target.value)}
        size="small"
        label="Key"
        sx={{ width: 120 }}
      />
      <TextField
        value={field.type ?? "text"}
        onChange={(e) => handleChange("type", e.target.value)}
        size="small"
        label="Type"
        select
        sx={{ width: 120 }}
      >
        {FIELD_TYPES.map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        value={field.label ?? ""}
        onChange={(e) => handleChange("label", e.target.value)}
        size="small"
        label="Label"
        sx={{ flexGrow: 1 }}
      />
      <IconButton size="small" onClick={onDelete}>
        <Delete />
      </IconButton>
    </Box>
  );
}
