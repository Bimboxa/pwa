import {useRef} from "react";

import {Box} from "@mui/material";

import FieldTextVariantGrid from "./FieldTextVariantGrid";
import FieldImageVariantGrid from "./FieldImageVariantGrid";
import FieldZonesVariantGrid from "./FieldZonesVariantGrid";
import FieldEntityVariantGrid from "./FieldEntityVariantGrid";

import getTemplateFields from "../utils/getTemplateFields";

export default function FormVariantGrid({
  template,
  item,
  onItemChange,
  selectorContainerRef,
}) {
  const formContainerRef = useRef(null);

  // state

  let templateFields = getTemplateFields(template);

  // handler

  function handleFieldValueChange(fieldKey, fieldValue) {
    onItemChange({...item, [fieldKey]: fieldValue});
  }

  return (
    <Box
      ref={formContainerRef}
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

        if (field?.type === "zones") {
          return (
            <FieldZonesVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              zonesTree={field.zonesTree}
              selectorContainerRef={selectorContainerRef}
            />
          );
        }

        if (field?.type === "entity") {
          return (
            <FieldEntityVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              entities={field.entities}
              formContainerRef={formContainerRef}
            />
          );
        }
      })}
    </Box>
  );
}
