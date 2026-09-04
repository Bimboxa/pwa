import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

const EMPTY = [];

// Location templates of a business-objects listing = the listing's OWN
// annotationTemplates (created from its properties panel with the same
// "Nouveau modèle" dialog as the Dessin popper, flagged
// isBusinessObjectAnnotation). A listing with at least one is "located": its
// objects get a "Localiser" action drawing their main annotation.
export default function useLocationAnnotationTemplates({ listing } = {}) {
  const listingId = listing?.id ?? null;
  // useAnnotationTemplates falls back to the whole project without a
  // listingId: guard so an unmounted / missing listing yields nothing.
  const templates = useAnnotationTemplates({
    filterByListingId: listingId ?? "__none__",
    sortByOrder: true,
  });
  if (!listingId) return EMPTY;
  return templates ?? EMPTY;
}
