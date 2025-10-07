import { Box } from "@mui/material";

import FieldTextVariantToolbar from "./FieldTextVariantToolbar";
import FieldNumberVariantToolbar from "./FieldNumberVariantToolbar";
import FieldColorVariantToolbar from "./FieldColorVariantToolbar";
import FieldIconVariantToolbar from "./FieldIconVariantToolbar";
import FieldOptionKeyFromIconsVariantToolbar from "./FieldOptionKeyFromIconsVariantToolbar";

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
    <Box sx={{ display: "flex", alignItems: "center", gap, p, zIndex: 2 }}>
      {template.fields
        .filter((field) => !Boolean(field.hide))
        .map((field) => {
          if (field.type === "text") {
            return (
              <FieldTextVariantToolbar
                key={field.key}
                label={field.label}
                width={field.width}
                placeholder={field.placeholder}
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

          if (field.type === "icon") {
            return (
              <FieldIconVariantToolbar
                key={field.key}
                value={item[field.key]}
                onChange={(newValue) =>
                  handleFieldValueChange(field.key, newValue)
                }
                spriteImage={field.spriteImage}
                options={field.options}
              />
            );
          }

          if (field.type === "optionKeyFromIcons") {
            return (
              <FieldOptionKeyFromIconsVariantToolbar
                key={field.key}
                value={item[field.key]}
                onChange={(newValue) =>
                  handleFieldValueChange(field.key, newValue)
                }
                valueOptions={field.valueOptions}
              />
            );
          }
        })}
    </Box>
  );
}
