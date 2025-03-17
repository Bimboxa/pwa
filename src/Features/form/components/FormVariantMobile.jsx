import {useState} from "react";

import {Box} from "@mui/material";

import FieldTextVariantMobile from "./FieldTextVariantMobile";
import FieldImageVariantMobile from "./FieldImageVariantMobile";
//import FieldNumberVariantMobile from "./FieldNumberVariantMobile";
//import FieldColorVariantMobile from "./FieldColorVariantMobile";

import FormVariantMobileActions from "./FormVariantMobileActions";
import FormVariantMobileOverview from "./FormVariantMobileOverview";

import getTemplateFields from "../utils/getTemplateFields";

export default function FormVariantMobile({template, item, onItemChange}) {
  // state

  let templateFields = getTemplateFields(template);
  templateFields = [...templateFields, {key: "_overview"}];

  const [fieldIndex, setFieldIndex] = useState(0);

  // helpers

  const field = templateFields[fieldIndex];
  const showOverview = field?.key === "_overview";

  // handlers - actions

  function handleBackClick() {
    if (fieldIndex > 0) setFieldIndex((index) => index - 1);
  }

  function handleForwardClick() {
    if (fieldIndex < templateFields.length - 1)
      setFieldIndex((index) => index + 1);
  }

  function handleFieldClick(field) {
    const index = templateFields.findIndex((f) => f.key === field.key);
    if (index !== -1) setFieldIndex(index);
  }

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
      {field?.type === "text" && (
        <FieldTextVariantMobile
          key={field.key}
          label={field.label}
          width={field.width}
          value={item[field.key]}
          onChange={(newValue) => handleFieldValueChange(field.key, newValue)}
          options={field.options}
        />
      )}
      {field?.type === "image" && (
        <FieldImageVariantMobile
          key={field.key}
          label={field.label}
          width={field.width}
          value={item[field.key]}
          onChange={(newValue) => handleFieldValueChange(field.key, newValue)}
          options={field.options}
        />
      )}
      {!showOverview && (
        <FormVariantMobileActions
          onBackClick={handleBackClick}
          onForwardClick={handleForwardClick}
        />
      )}

      {showOverview && (
        <FormVariantMobileOverview
          template={template}
          item={item}
          onFieldClick={handleFieldClick}
        />
      )}
    </Box>
  );
}
