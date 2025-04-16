import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useListingEntityModel(listing) {
  // data

  const appConfig = useAppConfig();

  return appConfig?.entityModelsObject?.[listing?.entityModelKey] ?? null;
}
