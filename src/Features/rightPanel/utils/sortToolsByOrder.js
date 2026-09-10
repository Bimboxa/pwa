// Tools pinned at the top of the right band whatever the per-scope order:
// "Propriétés" is force-injected in every module (useRightPanelTools
// invariant) and must stay reachable at a fixed place. Mirrors
// PINNED_TOP_MODULE_KEYS of viewers/utils/sortModulesByOrder.
export const PINNED_TOP_TOOL_KEYS = ["SELECTION_PROPERTIES"];

// Hoists the pinned tools in front, keeping their incoming order between
// themselves. Applied on both branches of sortToolsByOrder so the band and
// the Configuration page always agree.
function hoistPinnedTools(tools) {
  const pinned = tools.filter((t) => PINNED_TOP_TOOL_KEYS.includes(t.key));
  if (pinned.length === 0) return tools;
  const rest = tools.filter((t) => !PINNED_TOP_TOOL_KEYS.includes(t.key));
  return [...pinned, ...rest];
}

// Applies a per-scope tool order (scopeConfigs.toolOrder, a list of tool
// keys) to a tool list: known keys first in the stored order, then the tools
// the stored order does not know (a tool added to the catalog after the
// order was saved) in their incoming order. Keys of the stored order that
// match no tool are ignored. null / empty order => incoming order (legacy
// scopes without the field). The pinned tools are hoisted last so no stored
// order can push them down.
//
// The `group: "bottom"` tools keep their own bottom-anchored section in the
// band whatever their rank (VerticalMenuV2 splits on the field), so a stored
// order only ever reorders tools inside their own section.
export default function sortToolsByOrder(tools, order) {
  if (!order?.length) return hoistPinnedTools(tools);
  const rankByKey = new Map(order.map((key, index) => [key, index]));
  const known = tools
    .filter((t) => rankByKey.has(t.key))
    .sort((a, b) => rankByKey.get(a.key) - rankByKey.get(b.key));
  const unknown = tools.filter((t) => !rankByKey.has(t.key));
  return hoistPinnedTools([...known, ...unknown]);
}
