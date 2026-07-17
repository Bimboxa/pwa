import parseMainQtyLabel from "./parseMainQtyLabel";

// Merges manual qty overrides into a qtiesById map ({ [templateId]: { mainQtyLabel, ... } }).
// Each overridden template gets its mainQtyLabel rebuilt with the manual value,
// keeping the unit parsed from the computed label.
export default function applyHardCodedQties(qtiesById, hardCodedQtiesById) {
  const entries = Object.entries(hardCodedQtiesById ?? {}).filter(([, v]) =>
    Number.isFinite(v)
  );
  if (!entries.length) return qtiesById;

  const merged = { ...(qtiesById ?? {}) };
  entries.forEach(([templateId, manualQty]) => {
    const stats = merged[templateId];
    const { unit } = parseMainQtyLabel(stats?.mainQtyLabel);
    merged[templateId] = {
      ...stats,
      mainQtyLabel: `${Number(manualQty.toFixed(1))}${unit ? ` ${unit}` : ""}`,
      isHardCoded: true,
    };
  });
  return merged;
}
