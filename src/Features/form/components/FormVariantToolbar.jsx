import { Paper } from "@mui/material";

import FieldTextVariantToolbar from "./FieldTextVariantToolbar";
import FieldNumberVariantToolbar from "./FieldNumberVariantToolbar";
import FieldColorVariantToolbar from "./FieldColorVariantToolbar";

export default function FormVariantToolbar({
  template,
  gap,
  p,
  item,
  onItemChange,
}) {
  // handler

  function handleFieldValueChange(fieldKey, fieldValue) {
    onItemChange({ ...item, [fieldKey]: fieldValue });
  }

  return (
    <Paper sx={{ display: "flex", alignItems: "center", gap, p, zIndex: 2 }}>
      {template.fields.map((field) => {
        if (field.type === "text") {
          return (
            <FieldTextVariantToolbar
              key={field.key}
              label={field.label}
              width={field.width}
              value={item[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          );
        }
        if (field.type === "number") {
          return (
            <FieldNumberVariantToolbar
              key={field.key}
              label={field.label}
              width={field.width}
              value={item[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
            />
          );
        }
        if (field.type === "color") {
          return (
            <FieldColorVariantToolbar
              key={field.key}
              value={item[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
            />
          );
        }
      })}
    </Paper>
  );
}
