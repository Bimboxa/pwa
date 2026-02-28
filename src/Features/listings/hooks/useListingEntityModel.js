import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useListingEntityModel(listing) {
  // data

  const appConfig = useAppConfig();

  return (
    listing?.entityModel ??
    appConfig?.entityModelsObject?.[listing?.entityModelKey] ??
    null
  );
}
