// Group key of a template `groupLabel`: case / spacing insensitive.
export function normalizeLegendGroupLabel(groupLabel) {
  return (groupLabel ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Group headers of a set of legend rows, by normalized `groupLabel`:
 *
 *   { [groupKey]: { name, hidden } }
 *
 * - `name`: the legend name of the group — `groupLabelLegend` of its
 *   templates when set (legend editor of the capture tool), else their
 *   `groupLabel`;
 * - `hidden`: the header is not drawn in the legend
 *   (`groupLabelHiddenInLegend` on a template of the group). The rows of the
 *   group stay.
 *
 * Both fields are written on every template of the group; reading them from
 * any row keeps a template added to the group afterwards in line.
 */
export default function getLegendGroupHeaders(items) {
  const headers = {};
  (items ?? []).forEach((item) => {
    const key = normalizeLegendGroupLabel(item?.groupLabel);
    if (!key) return;
    if (!headers[key])
      headers[key] = {
        name: item.groupLabel.trim(),
        hidden: false,
        named: false,
      };
    const header = headers[key];
    const legendName = (item.groupLabelLegend ?? "").trim();
    if (legendName && !header.named) {
      header.name = legendName;
      header.named = true;
    }
    if (item.groupLabelHiddenInLegend) header.hidden = true;
  });
  return headers;
}
