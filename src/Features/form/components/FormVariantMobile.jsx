import {useState, useEffect} from "react";

import {Box} from "@mui/material";

import FieldTextVariantMobile from "./FieldTextVariantMobile";
import FieldImageVariantMobile from "./FieldImageVariantMobile";
import FieldZoneVariantMobile from "./FieldZoneVariantMobile";
import FieldCategoryVariantMobile from "./FieldCategoryVariantMobile";
import FieldOptionVariantMobile from "./FieldOptionVariantMobile";
import FieldEntityVariantMobile from "./FieldEntityVariantMobile";
import FieldTreeItemsVariantMobile from "./FieldTreeItemsVariantMobile";
import FieldQrcodeVariantMobile from "./FieldQrcodeVariantMobile";

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
  focusOnFirstField,
}) {
  // state

  let templateFields = getTemplateFields(template);
  console.log("templateFields", templateFields);
  templateFields = [...templateFields, {key: "_overview"}];
  const lastIndex = templateFields.length - 1;

  const [fieldIndex, setFieldIndex] = useState(0);

  useEffect(() => {
    if (templateFields.length > 0) {
      if (focusOnFirstField) {
        setFieldIndex(0);
      } else {
        setFieldIndex(lastIndex);
      }
    }
  }, [item?.id, templateFields?.length]);

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
              value={item?.[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          )}
          {field?.type === "zone" && (
            <FieldZoneVariantMobile
              key={field.key}
              label={field.label}
              zonesTree={field.zonesTree}
              zonesListing={field.zonesListing}
              value={item?.[field.key]}
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
              value={item?.[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          )}
          {field?.type === "entity" && (
            <FieldEntityVariantMobile
              key={field.key}
              label={field.label}
              width={field.width}
              value={item?.[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              entities={field.entities}
              entitiesListing={field.entitiesListing}
            />
          )}
          {field?.type === "option" && (
            <FieldOptionVariantMobile
              key={field.key}
              label={field.label}
              valueOptions={field.valueOptions}
              value={item?.[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          )}
          {field?.type === "treeItems" && (
            <FieldTreeItemsVariantMobile
              key={field.key}
              label={field.label}
              tree={field.tree}
              value={item?.[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          )}
          {field?.type === "qrcode" && (
            <FieldQrcodeVariantMobile
              key={field.key}
              label={field.label}
              value={item?.[field.key]}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
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
