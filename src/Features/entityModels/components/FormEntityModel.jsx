import { Box, MenuItem, TextField } from "@mui/material";

import FieldsEditor from "./FieldsEditor";

const ENTITY_MODEL_TYPES = [
  { key: "LOCATED_ENTITY", label: "Located entity" },
  { key: "BASE_MAP", label: "Base map" },
  { key: "BLUEPRINT", label: "Blueprint" },
];

export default function FormEntityModel({ model, onChange }) {
  // handlers

  function handleChange(prop, value) {
    onChange({ ...model, [prop]: value });
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: 2,
        overflow: "auto",
        flexGrow: 1,
      }}
    >
      <TextField
        label="Key"
        value={model?.key ?? ""}
        onChange={(e) => handleChange("key", e.target.value)}
        size="small"
        fullWidth
        disabled={model?.readonly}
      />
      <TextField
        label="Name"
        value={model?.name ?? ""}
        onChange={(e) => handleChange("name", e.target.value)}
        size="small"
        fullWidth
        disabled={model?.readonly}
      />
      <TextField
        label="Type"
        value={model?.type ?? ""}
        onChange={(e) => handleChange("type", e.target.value)}
        size="small"
        select
        fullWidth
        disabled={model?.readonly}
      >
        {ENTITY_MODEL_TYPES.map((t) => (
          <MenuItem key={t.key} value={t.key}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Default table"
        value={model?.defaultTable ?? ""}
        onChange={(e) => handleChange("defaultTable", e.target.value)}
        size="small"
        fullWidth
        disabled={model?.readonly}
      />
      <TextField
        label="Default color"
        value={model?.defaultColor ?? ""}
        onChange={(e) => handleChange("defaultColor", e.target.value)}
        size="small"
        fullWidth
        disabled={model?.readonly}
      />
      <TextField
        label="Default icon key"
        value={model?.defaultIconKey ?? ""}
        onChange={(e) => handleChange("defaultIconKey", e.target.value)}
        size="small"
        fullWidth
        disabled={model?.readonly}
      />
      <TextField
        label="Label key"
        value={model?.labelKey ?? ""}
        onChange={(e) => handleChange("labelKey", e.target.value)}
        size="small"
        fullWidth
        disabled={model?.readonly}
      />
      <FieldsEditor
        fieldsObject={model?.fieldsObject ?? {}}
        onChange={(fieldsObject) => handleChange("fieldsObject", fieldsObject)}
      />
    </Box>
  );
}
