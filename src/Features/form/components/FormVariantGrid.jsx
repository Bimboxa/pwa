import {useState} from "react";

import {Box} from "@mui/material";

import FieldTextVariantGrid from "./FieldTextVariantGrid";
import FieldImageVariantGrid from "./FieldImageVariantGrid";

import getTemplateFields from "../utils/getTemplateFields";

export default function FormVariantGrid({template, item, onItemChange}) {
  // state

  let templateFields = getTemplateFields(template);

  // handler

  function handleFieldValueChange(fieldKey, fieldValue) {
    onItemChange({...item, [fieldKey]: fieldValue});
  }

  return (
    <Box
      sx={{
        display: "flex",
        width: 1,
        height: 1,
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {templateFields?.map((field) => {
        const value = item ? item[field.key] : null;
        if (field?.type === "text") {
          return (
            <FieldTextVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          );
        }

        if (field?.type === "image") {
          return (
            <FieldImageVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
            />
          );
        }
      })}
    </Box>
  );
}
