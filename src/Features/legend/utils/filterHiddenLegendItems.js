// Drops the legend items flagged `hiddenInLegend` (hooks called with
// includeHiddenInLegend keep them so the capture legend editor can list them)
// and the headers left empty by that removal: a `listingName` with no item
// before the next listing, a `groupLabel` with no item before the next header,
// and a `groupDivider` that no longer separates two items.
export default function filterHiddenLegendItems(legendItems) {
  if (!legendItems?.length) return legendItems ?? [];

  const kept = legendItems.filter((it) => !it.hiddenInLegend);
  const isHeader = (it) =>
    it.type === "listingName" ||
    it.type === "groupLabel" ||
    it.type === "groupDivider";

  const result = [];
  kept.forEach((it, i) => {
    if (it.type === "listingName") {
      // keep only when at least one item follows before the next listing
      let j = i + 1;
      while (j < kept.length && kept[j].type !== "listingName") {
        if (!isHeader(kept[j])) {
          result.push(it);
          return;
        }
        j++;
      }
      return;
    }
    if (it.type === "groupLabel") {
      // keep only when the very next non-divider entry is an item
      const next = kept[i + 1];
      if (next && !isHeader(next)) result.push(it);
      return;
    }
    if (it.type === "groupDivider") {
      // keep only between two items
      const prev = result[result.length - 1];
      const next = kept[i + 1];
      if (prev && !isHeader(prev) && next && !isHeader(next)) result.push(it);
      return;
    }
    result.push(it);
  });

  return result;
}
