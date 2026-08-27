import { Box } from "@mui/material";

import DebouncedTextField from "Features/form/components/DebouncedTextField";

// Form generated from manifest.fields. Two usages:
// - creation dialogs: controlled local state, values prefilled from mappedTo
// - properties panel: direct-persist onChange
export default function TitleBlockFieldsForm({ manifest, values, onChange }) {
  const fields = manifest?.fields || [];
  if (fields.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {fields.map((field) => (
        <DebouncedTextField
          key={field.key}
          label={field.label}
          size="small"
          value={values?.[field.key] || ""}
          onChange={(val) => onChange(field.key, val)}
          fullWidth
        />
      ))}
    </Box>
  );
}
