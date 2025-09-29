import useSelectedListing from "./useSelectedListing";

export default function useSelectedEntityModel() {
  const { value: listing } = useSelectedListing();

  return listing?.entityModel;
}
