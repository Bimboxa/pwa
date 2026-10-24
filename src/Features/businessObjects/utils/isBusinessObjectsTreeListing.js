import { getNotesAppSettings } from "Features/notesApp/utils/notesAppListingSettings";

// Does the listing organise its objects as a tree (sub-objects, level
// navigation of BusinessObjectsTree) or as a flat list (Krnet "Sondages",
// "Prélèvements"…)? Krnet setting `settings.treeMode` ("Mode arbre
// (hiérarchie)"), stored under listing.notesApp.settings with the Krnet
// "delete when false" rule: on a listing carrying a Krnet configuration
// block (linked, pulled or configured locally) an absent key means flat. A
// listing without any Krnet block keeps the historical hierarchical display.
export default function isBusinessObjectsTreeListing(listing) {
  if (!listing?.notesApp) return true;
  return Boolean(getNotesAppSettings(listing).treeMode);
}
