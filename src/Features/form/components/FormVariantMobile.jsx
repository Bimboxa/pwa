import {useState, useEffect} from "react";

import {Box} from "@mui/material";

import FieldTextVariantMobile from "./FieldTextVariantMobile";
import FieldImageVariantMobile from "./FieldImageVariantMobile";
import FieldCategoryVariantMobile from "./FieldCategoryVariantMobile";

//import FieldNumberVariantMobile from "./FieldNumberVariantMobile";
//import FieldColorVariantMobile from "./FieldColorVariantMobile";

import FormVariantMobileActions from "./FormVariantMobileActions";
import FormVariantMobileOverview from "./FormVariantMobileOverview";

import getTemplateFields from "../utils/getTemplateFields";
import DialogGeneric from "Features/layout/components/DialogGeneric";

export default function FormVariantMobile({
  template,
  item,
  onItemChange,
  lastItem,
}) {
  // state

  let templateFields = getTemplateFields(template);
  templateFields = [...templateFields, {key: "_overview"}];
  const lastIndex = templateFields.length - 1;

  const [fieldIndex, setFieldIndex] = useState(0);

  useEffect(() => {
    //setFieldIndex(0);
    setFieldIndex(lastIndex);
  }, [item?.id]);

  // helpers

  const field = templateFields[fieldIndex];
  const showOverview = field?.key === "_overview";
  const openDialog = field?.key !== "_overview";

  // handlers - actions

  function handleBackClick() {
    if (fieldIndex > 0) setFieldIndex((index) => index - 1);
  }

  function handleForwardClick() {
    if (fieldIndex < templateFields.length - 1)
      console.log("[Forward] fieldIndex", fieldIndex + 1);
    setFieldIndex((index) => index + 1);
  }

  function handleFieldClick(field) {
    const index = templateFields.findIndex((f) => f.key === field.key);
    console.log("[handleFieldClick] field", index);
    if (index !== -1) setFieldIndex(index);
  }

  // handler

  function handleFieldValueChange(fieldKey, fieldValue) {
    onItemChange({...item, [fieldKey]: fieldValue});
    setFieldIndex(lastIndex);
  }

  return (
    <>
      {openDialog && (
        <DialogGeneric
          title={field.label}
          onClose={() => setFieldIndex(lastIndex)}
          open={openDialog}
        >
          {field?.type === "text" && (
            <FieldTextVariantMobile
              key={field.key}
              label={field.label}
              width={field.width}
              value={item?.[field.key]}
              lastValue={lastItem?.[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
              onNext={handleForwardClick}
            />
          )}
          {field?.type === "image" && (
            <FieldImageVariantMobile
              key={field.key}
              label={field.label}
              width={field.width}
              value={item[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          )}
          {field?.type === "category" && (
            <FieldCategoryVariantMobile
              key={field.key}
              label={field.label}
              nomenclature={field.nomenclature}
              value={item[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          )}
        </DialogGeneric>
      )}
      <Box
        sx={{
          display: "flex",
          width: 1,
          height: 1,
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        {/* {!showOverview && (
          <FormVariantMobileActions
            onBackClick={handleBackClick}
            onForwardClick={handleForwardClick}
            onShowOverviewClick={() => setFieldIndex(templateFields.length - 1)}
          />
        )} */}

        {showOverview && (
          <FormVariantMobileOverview
            template={template}
            item={item}
            onFieldClick={handleFieldClick}
          />
        )}
      </Box>
    </>
  );
}
