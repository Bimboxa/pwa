// Applies a per-scope module order (scopeConfigs.moduleOrder, a list of
// module keys) to the module catalog: known keys first in the stored order,
// then the modules the stored order does not know (a module or a business
// object type added after the order was saved) in catalog order. Keys of the
// stored order that match no module are ignored. null / empty order =>
// catalog order (legacy scopes without the field).
export default function sortModulesByOrder(modules, order) {
  if (!order?.length) return modules;
  const rankByKey = new Map(order.map((key, index) => [key, index]));
  const known = modules
    .filter((m) => rankByKey.has(m.key))
    .sort((a, b) => rankByKey.get(a.key) - rankByKey.get(b.key));
  const unknown = modules.filter((m) => !rankByKey.has(m.key));
  return [...known, ...unknown];
}
