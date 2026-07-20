// Builds a flattened tree from flat zone rows: [{zone, depth}], siblings
// ordered by fractional sortIndex, children right after their parent
// (depth-first). Orphan zones (deleted/missing parent) are treated as roots.

export default function buildZonesTree(zones) {
  if (!zones?.length) return [];

  const zoneIds = new Set(zones.map((z) => z.id));

  const childrenByParentId = {};
  zones.forEach((zone) => {
    const parentKey =
      zone.parentId && zoneIds.has(zone.parentId) ? zone.parentId : "ROOT";
    if (!childrenByParentId[parentKey]) childrenByParentId[parentKey] = [];
    childrenByParentId[parentKey].push(zone);
  });

  Object.values(childrenByParentId).forEach((siblings) =>
    siblings.sort((a, b) =>
      String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
    )
  );

  const flat = [];
  const visit = (parentKey, depth) => {
    const siblings = childrenByParentId[parentKey] ?? [];
    siblings.forEach((zone) => {
      flat.push({ zone, depth });
      visit(zone.id, depth + 1);
    });
  };
  visit("ROOT", 0);

  return flat;
}

export function getZoneDescendants(zones, zoneId) {
  const childrenByParentId = {};
  zones.forEach((zone) => {
    const parentKey = zone.parentId ?? "ROOT";
    if (!childrenByParentId[parentKey]) childrenByParentId[parentKey] = [];
    childrenByParentId[parentKey].push(zone);
  });

  const descendants = [];
  const visit = (id) => {
    (childrenByParentId[id] ?? []).forEach((child) => {
      descendants.push(child);
      visit(child.id);
    });
  };
  visit(zoneId);

  return descendants;
}
