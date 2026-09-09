import PanelBusinessObjects from "./PanelBusinessObjects";

// Left drawer panel of a business-objects module, by business object type
// (businessObjectTypesCatalog). Adding a type = a registry entry + one line
// here. Unknown type => the STANDARD panel.
const PANEL_BY_TYPE_KEY = {
  STANDARD: PanelBusinessObjects,
  // Category trees: the same listing selector + tree panel.
  NOMENCLATURE: PanelBusinessObjects,
  // Tasks: the same panel, the type's features (hoursBudget) drive the
  // ratio / hours columns and the total band.
  PLANNING: PanelBusinessObjects,
};

export default function PanelBusinessObjectsByType({ typeKey }) {
  const Panel = PANEL_BY_TYPE_KEY[typeKey] ?? PanelBusinessObjects;
  return <Panel typeKey={typeKey} />;
}
