import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListings from "Features/listings/hooks/useListings";

export default function useAnnotationTemplatesListingInMapEditor() {
  const { value: listing } = useSelectedListing();
  const listings = useListings({ filterByProjectId: listing?.projectId });

  return listings?.find(
    (l) => listing?.annotationTemplatesListingKey === l.key
  );
}
