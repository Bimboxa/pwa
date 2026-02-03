import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import iconsMap from "../data/iconsMap";
import theme from "Styles/theme";

export default function useListingFormTemplate(listing, options) {
  // options

  const locatedListingOnly = options?.locatedListingOnly;
  const relatedListings = options?.relatedListings;
  const variant = options?.variant; // basic, standard

  // data

  const appConfig = useAppConfig();

  // helpers - entityModels

  const entityModelsObject = appConfig?.entityModelsObject;

  const entityModels = appConfig?.features?.entityModels?.keys?.map(
    (entityModelKey) => ({
      ...entityModelsObject[entityModelKey],
      id: entityModelKey,
      label: entityModelsObject[entityModelKey]?.name,
    })
  );

  // helpers

  const iconColor = listing?.color ?? theme.palette.secondary.main;

  // helpers - optionsEntityModels

  let optionsEntityModels = entityModels;
  if (locatedListingOnly) {
    optionsEntityModels = optionsEntityModels.filter(
      (entityModel) => entityModel.type === "LOCATED_ENTITY"
    );
  }

  let placeholder = "Liste XXX";
  if (options.locatedListingOnly) placeholder = "PIC, réception, DAT,...";

  // helpers - relatedListings selectors for models with listingKey

  const entityModel = listing?.entityModel ?? {};
  const selectorFields = [];
  if (entityModel?.fieldsObject) {
    Object.entries(entityModel?.fieldsObject)?.forEach(([key, field]) => {
      // key: category,field: {nomenclature:{listingKey,selectorLabel,entityModelType,entityModelKey}}
      Object.entries(field)?.forEach(([key, value]) => {
        if (value.listingKey) {
          selectorFields.push({
            key: value.listingKey,
            type: "option",
            valueOptions: relatedListings?.filter(
              (listing) => listing.entityModel?.type === value.entityModelType
            ),
            label: value.selectorLabel,
            parentObject: "relatedListings",
            options: { labelKey: "name" },
          });
        }
      });
    });
  }

  // main

  const template = {
    fields: [
      {
        key: "name",
        label: "Nom",
        type: "text",
        options: { showAsSection: true, fullWidth: true, placeholder },
      },
      {
        key: "entityModel",
        label: "Type d'objet",
        type: "option",
        valueOptions: optionsEntityModels,
        options: {
          firstOptionByDefault: optionsEntityModels?.length === 1,
          displayNone: optionsEntityModels?.length === 1,
          labelKey: "name",
        },
        hidden: variant === "basic",
      },
      ...selectorFields,
      {
        key: "color",
        label: "Couleur",
        type: "color",
      },

      {
        key: "iconKey",
        label: "Icône",
        type: "iconBasic",
        options: { iconsMap, iconColor },
      },
      {
        key: "showNewAnnotationToolbar",
        label: "Afficher la barre d'outils",
        type: "check",
      },

      {
        key: "canCreateItem",
        label: "Créer des entités",
        type: "check",
        ...(locatedListingOnly && { hidden: true }),
        hidden: variant === "basic",
      },
      {
        key: "table",
        label: "Table",
        type: "optionKey",
        valueOptions: [{ key: "entities", label: "Défault" }],
        options: { showAsSection: true },
        ...(locatedListingOnly && { hidden: true }),
        hidden: variant === "basic",
      },
    ],
  };

  return template;
}
