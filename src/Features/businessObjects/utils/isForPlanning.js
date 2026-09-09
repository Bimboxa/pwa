// "Planning" annotation listing: a drawing list (LOCATED_ENTITY) declared as
// feeding the PLANNING module. OPT-IN flag on the listing row
// (listing.isForPlanning), missing = false. Declarative only: it drives the
// "Liste d'annotations" section of a PLANNING listing properties panel and
// nothing else — work packages, annotation links and the hours computation
// still see every annotation of the scope.
export default function isForPlanning(listing) {
  return listing?.isForPlanning === true;
}
