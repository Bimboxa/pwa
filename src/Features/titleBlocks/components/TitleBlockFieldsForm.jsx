import { Box } from "@mui/material";

import DebouncedTextField from "Features/form/components/DebouncedTextField";

// Form generated from manifest.fields. Two usages:
// - creation dialogs: controlled local state, values prefilled from mappedTo
// - properties panel: direct-persist onChange
// `placeholders` (getTitleBlockPlaceholders) shows the live default of a
// field left empty (e.g. chantier -> project name).
export default function TitleBlockFieldsForm({
  manifest,
  values,
  onChange,
  placeholders,
}) {
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
          placeholder={placeholders?.[field.key]}
          fullWidth
        />
      ))}
    </Box>
  );
}
