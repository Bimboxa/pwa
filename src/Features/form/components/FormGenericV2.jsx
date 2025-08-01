import { useRef } from "react";

import { Box } from "@mui/material";

import FieldTextV2 from "./FieldTextV2";
import FieldImageV2 from "./FieldImageV2";
import FieldBaseMap from "./FieldBaseMap";

import FieldZonesVariantGrid from "./FieldZonesVariantGrid";
import FieldZoneVariantGrid from "./FieldZoneVariantGrid";
import FieldOptionVariantGrid from "./FieldOptionVariantGrid";
import FieldEntityVariantGrid from "./FieldEntityVariantGrid";
import FieldCategoryVariantGrid from "./FieldCategoryVariantGrid";
import FieldQrcodeVariantGrid from "./FieldQrcodeVariantGrid";

import getTemplateFields from "../utils/getTemplateFields";

export default function FormGenericV2({
  template,
  item,
  onItemChange,
  createContainerEl,
}) {
  const formContainerRef = useRef(null);

  // state

  let templateFields = getTemplateFields(template);

  // handler

  function handleFieldValueChange(fieldKey, fieldValue) {
    onItemChange({ ...item, [fieldKey]: fieldValue });
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
            <FieldTextV2
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
            <FieldImageV2
              key={field.key}
              label={field.label}
              width={field.width}
              options={field.options}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              formContainerRef={formContainerRef}
            />
          );
        }

        if (field?.type === "baseMap") {
          return (
            <FieldBaseMap
              key={field.key}
              label={field.label}
              baseMaps={field.baseMaps}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              formContainerRef={formContainerRef}
              createContainerEl={createContainerEl}
            />
          );
        }
        if (field?.type === "zone") {
          return (
            <FieldZoneVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              zonesTree={field.zonesTree}
              zonesListing={field.zonesListing}
              formContainerRef={formContainerRef}
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
              zonesListing={field.zonesListing}
              formContainerRef={formContainerRef}
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
              entitiesListing={field.entitiesListing}
              formContainerRef={formContainerRef}
            />
          );
        }

        if (field?.type === "option") {
          return (
            <FieldOptionVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              valueOptions={field.valueOptions}
              formContainerRef={formContainerRef}
            />
          );
        }

        if (field?.type === "category") {
          return (
            <FieldCategoryVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              nomenclature={field.nomenclature}
              formContainerRef={formContainerRef}
            />
          );
        }

        if (field?.type === "qrcode") {
          return (
            <FieldQrcodeVariantGrid
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              formContainerRef={formContainerRef}
            />
          );
        }
      })}
    </Box>
  );
}
