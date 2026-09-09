// "Located" business-object listing: its objects can get a MAIN annotation
// per base map, drawn from the Dessin popper (business-object mode) with the
// listing's own location templates. OPT-IN flag on the listing row
// (listing.canLocateBusinessObjects), missing = false. Only the main-location
// flow is gated: linking existing annotations ("Mode liaison", "Lier à un
// ouvrage") stays available, and existing main annotations stay listed /
// removable. Krnet-mapped listings are always located (syncNotesAppScope).
export default function canLocateBusinessObjects(listing) {
  return listing?.canLocateBusinessObjects === true;
}
