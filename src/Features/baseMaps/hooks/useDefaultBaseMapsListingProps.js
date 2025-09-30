/*
 * this hook is used to get the default listing object to use in the useCreateListing hook.
 */

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useDefaultBaseMapsListingProps() {
  // data

  const appConfig = useAppConfig();
  const entityModel = appConfig?.entityModelsObject?.baseMap;

  // main

  const props = {
    color: entityModel?.defaultColor,
    iconKey: entityModel?.defaultIconKey,
    entityModelKey: entityModel?.key,
    name: entityModel?.defaultListingName,
    table: entityModel?.defaultTable,
    canCreateItem: true,
  };

  // return

  return props;
}
