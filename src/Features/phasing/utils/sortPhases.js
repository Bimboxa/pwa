// The phases of a PHASING listing, in order: its live business objects
// sorted by fractional sortIndex (the listing is flat — same comparator as
// buildBusinessObjectsChildrenMap, so the strip follows the list).
//
// Pure: node-testable.
export default function sortPhases(businessObjects) {
  return (businessObjects ?? [])
    .filter((o) => o && !o.deletedAt && !o.isTitle)
    .sort((a, b) =>
      String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
    );
}
