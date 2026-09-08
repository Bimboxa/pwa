import {
  Foundation,
  Construction,
  Handyman,
  Engineering,
  Category,
  Inventory,
  Widgets,
  ViewList,
  Checklist,
  Assignment,
  Task,
  EventNote,
  CalendarMonth,
  Timeline,
  AccountTree,
  Apartment,
  Roofing,
  Plumbing,
  ElectricalServices,
  Carpenter,
  Layers,
} from "@mui/icons-material";

// Curated icons a scope can pick for a configurable left-band module
// (scopeConfigs.moduleIconKeysByKey: {moduleKey: iconKey}). Same shape as
// listings/data/iconsMap.js; a separate set because the band wants
// module-level glyphs (trades, planning), not listing semantics.
const moduleIconsMap = new Map([
  ["foundation", Foundation],
  ["construction", Construction],
  ["handyman", Handyman],
  ["engineering", Engineering],
  ["category", Category],
  ["inventory", Inventory],
  ["widgets", Widgets],
  ["viewList", ViewList],
  ["checklist", Checklist],
  ["assignment", Assignment],
  ["task", Task],
  ["eventNote", EventNote],
  ["calendarMonth", CalendarMonth],
  ["timeline", Timeline],
  ["accountTree", AccountTree],
  ["apartment", Apartment],
  ["roofing", Roofing],
  ["plumbing", Plumbing],
  ["electricalServices", ElectricalServices],
  ["carpenter", Carpenter],
  ["layers", Layers],
]);

export const MODULE_ICON_KEYS = [...moduleIconsMap.keys()];

// Icon component of a key; an unknown / removed key falls back to the given
// default key, then to "foundation".
export function getModuleIconComponent(iconKey, fallbackKey = "foundation") {
  return (
    moduleIconsMap.get(iconKey) ??
    moduleIconsMap.get(fallbackKey) ??
    moduleIconsMap.get("foundation")
  );
}

export default moduleIconsMap;
