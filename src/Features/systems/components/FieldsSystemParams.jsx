import { Box } from "@mui/material";

import FieldNumberWithUnit from "Features/form/components/FieldNumberWithUnit";

// Number fields of the parameters of a system procedure
// (`procedure.paramsDefinition = [{ key, label, unit, min? }]`).
// `values`: the effective values; `onChange(key, value)` on a valid edit.
export default function FieldsSystemParams({ procedure, values, onChange }) {
  // helpers

  const definitions = procedure?.paramsDefinition ?? [];

  // handlers

  function handleChange(definition, value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    if (number < (definition.min ?? 0)) return;
    if (number === Number(values?.[definition.key])) return;
    onChange(definition.key, number);
  }

  // render

  if (!definitions.length) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {definitions.map((definition) => (
        <FieldNumberWithUnit
          key={definition.key}
          label={definition.label ?? definition.key}
          unit={definition.unit ?? ""}
          value={values?.[definition.key] ?? ""}
          onChange={(value) => handleChange(definition, value)}
        />
      ))}
    </Box>
  );
}
