// Modules pinned at the top of the left band whatever the per-scope order:
// the SCOPE module is the entry point of the scope and must stay reachable at
// a fixed place. Needed because a `moduleOrder` saved before a module existed
// does not know its key, and unknown keys are appended LAST below.
export const PINNED_TOP_MODULE_KEYS = ["SCOPE"];

// Hoists the pinned modules in front, keeping their catalog order between
// themselves. Applied on both branches of sortModulesByOrder so the band, the
// module selector and the Configuration mockup always agree.
function hoistPinnedModules(modules) {
  const pinned = modules.filter((m) => PINNED_TOP_MODULE_KEYS.includes(m.key));
  if (pinned.length === 0) return modules;
  const rest = modules.filter((m) => !PINNED_TOP_MODULE_KEYS.includes(m.key));
  return [...pinned, ...rest];
}

// Applies a per-scope module order (scopeConfigs.moduleOrder, a list of
// module keys) to the module catalog: known keys first in the stored order,
// then the modules the stored order does not know (a module or a business
// object type added after the order was saved) in catalog order. Keys of the
// stored order that match no module are ignored. null / empty order =>
// catalog order (legacy scopes without the field). The pinned modules are
// hoisted last so no stored order can push them down.
export default function sortModulesByOrder(modules, order) {
  if (!order?.length) return hoistPinnedModules(modules);
  const rankByKey = new Map(order.map((key, index) => [key, index]));
  const known = modules
    .filter((m) => rankByKey.has(m.key))
    .sort((a, b) => rankByKey.get(a.key) - rankByKey.get(b.key));
  const unknown = modules.filter((m) => !rankByKey.has(m.key));
  return hoistPinnedModules([...known, ...unknown]);
}
