import useCreateAnnotationListing from "Features/listings/hooks/useCreateAnnotationListing";

// Create a new empty LOCATED_ENTITY listing by name and return the created
// listing (a normal annotations listing, see useCreateAnnotationListing).
export default function useCreateListingForObjects() {
  const createAnnotationListing = useCreateAnnotationListing();

  return async (name) => createAnnotationListing({ name });
}
