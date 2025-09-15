import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import iconsMap from "../data/iconsMap";

export default function useListingFormTemplate(listing) {
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

  const iconColor = listing?.color ?? "white";

  // main

  const template = {
    fields: [
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
        key: "name",
        label: "Nom",
        type: "text",
        options: { showAsSection: true, fullWidth: true },
      },
      {
        key: "entityModel",
        label: "Entité",
        type: "option",
        valueOptions: entityModels,
      },
      {
        key: "canCreateItem",
        label: "Créer des entités",
        type: "check",
      },
    ],
  };

  return template;
}
