import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import iconsMap from "../data/iconsMap";
import theme from "Styles/theme";

export default function useListingFormTemplate(listing, options) {
  // options

  const locatedListingOnly = options?.locatedListingOnly;

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
        },
      },
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
        key: "canCreateItem",
        label: "Créer des entités",
        type: "check",
        ...(locatedListingOnly && { hidden: true }),
      },
    ],
  };

  return template;
}
