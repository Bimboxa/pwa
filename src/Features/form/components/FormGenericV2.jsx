import { useRef } from "react";

import { Box } from "@mui/material";

import FieldSection from "./FieldSection";
import FieldTextV2 from "./FieldTextV2";
import FieldMetadata from "./FieldMetadata";
import FieldImageV2 from "./FieldImageV2";
import FieldImageKeyFromOptions from "./FieldImageKeyFromOptions";
import FieldColorV2 from "./FieldColorV2";
import FieldBaseMap from "./FieldBaseMap";
import FieldIcon from "./FieldIcon";
import FieldAnnotationTemplateId from "./FieldAnnotationTemplateId";
import FieldIconBasic from "./FieldIconBasic";
import FieldOptionSelector from "./FieldOptionSelector";
import FieldOptionKey from "./FieldOptionKey";
import FieldOptionKeyFromIconsVariantToolbar from "./FieldOptionKeyFromIconsVariantToolbar";
import FieldCheck from "./FieldCheck";
import FieldButton from "./FieldButton";
import FieldSlider from "./FieldSlider";

import FieldZonesVariantGrid from "./FieldZonesVariantGrid";
import FieldZoneVariantGrid from "./FieldZoneVariantGrid";

import FieldZoneV2 from "./FieldZoneV2";

import FieldOptionVariantGrid from "./FieldOptionVariantGrid";
import FieldEntityVariantGrid from "./FieldEntityVariantGrid";
import FieldEntityV2 from "./FieldEntityV2";
import FieldCategoryV2 from "./FieldCategoryV2";
import FieldQrcodeVariantGrid from "./FieldQrcodeVariantGrid";

import getTemplateFields from "../utils/getTemplateFields";

export default function FormGenericV2({
  template,
  item,
  onItemChange,
  createContainerEl,
  sectionContainerEl,
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
        //height: 1,
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {templateFields?.map((field) => {
        const value = item ? item[field.key] : null;

        if (field?.type === "section") {
          return <FieldSection key={field.key} label={field.label} />;
        }

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

        if (field?.type === "metadata") {
          return (
            <FieldMetadata
              key={field.key}
              label={field.label}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
            />
          );
        }

        if (field?.type === "check") {
          return (
            <FieldCheck
              key={field.key}
              label={field.label}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          );
        }

        if (field?.type === "slider") {
          return (
            <FieldSlider
              key={field.key}
              label={field.label}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          );
        }

        if (field?.type === "button") {
          return (
            <FieldButton
              key={field.key}
              label={field.label}
              options={field.options}
            />
          );
        }

        if (field?.type === "color") {
          return (
            <FieldColorV2
              key={field.key}
              label={field.label}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
            />
          );
        }

        if (field?.type === "icon") {
          return (
            <FieldIcon
              key={field.key}
              label={field.label}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              spriteImage={field.spriteImage}
              options={field.options}
            />
          );
        }

        if (field?.type === "iconBasic") {
          return (
            <FieldIconBasic
              key={field.key}
              label={field.label}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              options={field.options}
            />
          );
        }

        if (field?.type === "annotationTemplateId") {
          return (
            <FieldAnnotationTemplateId
              key={field.key}
              label={field.label}
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

        if (field?.type === "imageKeyFromOptions") {
          return (
            <FieldImageKeyFromOptions
              key={field.key}
              label={field.label}
              width={field.width}
              options={field.options}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
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
            <FieldZoneV2
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              zonesTree={field.zonesTree}
              zonesListing={field.zonesListing}
              sectionContainerEl={sectionContainerEl}
              options={field.options}
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
            <FieldEntityV2
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              entities={field.entities}
              entitiesListing={field.entitiesListing}
              sectionContainerEl={sectionContainerEl}
              options={field.options}
            />
          );
        }

        if (field?.type === "optionKey") {
          return (
            <FieldOptionKey
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              valueOptions={field.valueOptions}
              options={field.options}
            />
          );
        }

        if (field?.type === "option") {
          return (
            <FieldOptionSelector
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              valueOptions={field.valueOptions}
              options={field.options}
              formContainerRef={formContainerRef}
              sectionContainerEl={sectionContainerEl}
            />
          );
        }
        if (field?.type === "optionKeyFromIcons") {
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

        if (field?.type === "category") {
          return (
            <FieldCategoryV2
              key={field.key}
              label={field.label}
              width={field.width}
              value={value}
              onChange={(newValue) =>
                handleFieldValueChange(field.key, newValue)
              }
              nomenclature={field.nomenclature}
              sectionContainerEl={sectionContainerEl}
              options={field.options}
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
