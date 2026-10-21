// White rounded card flagged with the active listing accent: the selected
// listing row (or the collapsed active listing band) and, right below it,
// the templates block of that listing share this look on the grey panel
// background, so the link between the two reads at a glance. `accent` is
// `secondary.main`, or `listingFromOtherScope.main` for a listing linked
// from another scope.
export default function activeListingCardSx(accent = "secondary.main") {
  return {
    bgcolor: "background.paper",
    borderRadius: 2,
    borderLeft: "3px solid",
    borderLeftColor: accent,
    boxShadow: "0 1px 2px rgba(20, 20, 60, 0.08)",
  };
}
