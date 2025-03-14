import {useState} from "react";

import {Box} from "@mui/material";

import FieldTextVariantMobile from "./FieldTextVariantMobile";
//import FieldNumberVariantMobile from "./FieldNumberVariantMobile";
//import FieldColorVariantMobile from "./FieldColorVariantMobile";

import FormVariantMobileActions from "./FormVariantMobileActions";

import getTemplateFields from "../utils/getTemplateFields";

export default function FormVariantMobile({template, item, onItemChange}) {
  // state

  const templateFields = getTemplateFields(template);

  const [fieldIndex, setFieldIndex] = useState(0);

  const field = templateFields[fieldIndex];

  // handlers - actions

  function handleBackClick() {
    if (fieldIndex > 0) setFieldIndex((index) => index - 1);
  }

  function handleForwardClick() {
    if (fieldIndex < templateFields.length - 1)
      setFieldIndex((index) => index + 1);
  }

  // handler

  function handleFieldValueChange(fieldKey, fieldValue) {
    onItemChange({...item, [fieldKey]: fieldValue});
  }

  return (
    <Box sx={{display: "flex", width: 1, height: 1, flexDirection: "column"}}>
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
      <FormVariantMobileActions
        onBackClick={handleBackClick}
        onForwardClick={handleForwardClick}
      />
    </Box>
  );
}
