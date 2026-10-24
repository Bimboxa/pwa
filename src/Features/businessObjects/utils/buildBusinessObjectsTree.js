// Builds a flattened tree from flat business-object rows:
// [{businessObject, depth, parentPath}], siblings ordered by fractional
// sortIndex, children right after their parent (depth-first). Orphan
// objects (deleted/missing parent) are treated as roots.
//
// `scopeId` (Krnet TreeList "scope"): the walk starts under that object —
// depth 0 = its children — and `parentPath` joins the labels of the
// ancestors between the scope (excluded) and the object (excluded) with
// " / ". An unknown scope id falls back to the root (the Viewer panel may
// display another listing than the one the stored scope belongs to).

const PATH_SEPARATOR = " / ";

// parentId (or "ROOT") -> children sorted by sortIndex. Objects whose
// parent is not in `businessObjects` hang from the root.
export function buildBusinessObjectsChildrenMap(businessObjects) {
  const ids = new Set((businessObjects ?? []).map((o) => o.id));
  const childrenByParentId = {};
  (businessObjects ?? []).forEach((object) => {
    const parentKey =
      object.parentId && ids.has(object.parentId) ? object.parentId : "ROOT";
    if (!childrenByParentId[parentKey]) childrenByParentId[parentKey] = [];
    childrenByParentId[parentKey].push(object);
  });
  Object.values(childrenByParentId).forEach((siblings) =>
    siblings.sort((a, b) =>
      String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
    )
  );
  return childrenByParentId;
}

export default function buildBusinessObjectsTree(
  businessObjects,
  { scopeId = null } = {}
) {
  if (!businessObjects?.length) return [];

  const childrenByParentId = buildBusinessObjectsChildrenMap(businessObjects);
  const hasScope =
    scopeId != null && businessObjects.some((o) => o.id === scopeId);

  const flat = [];
  const visited = new Set(); // cycle guard
  const visit = (parentKey, depth, path) => {
    const siblings = childrenByParentId[parentKey] ?? [];
    siblings.forEach((object) => {
      if (visited.has(object.id)) return;
      visited.add(object.id);
      flat.push({ businessObject: object, depth, parentPath: path });
      const label = object.label ?? "";
      visit(
        object.id,
        depth + 1,
        path ? `${path}${PATH_SEPARATOR}${label}` : label
      );
    });
  };
  visit(hasScope ? scopeId : "ROOT", 0, "");

  return flat;
}

// Display metadata of a flattened tree, aligned with the flatTree indexes:
// [{number, titleAncestors, objectAncestors}] where `number` is the
// hierarchical numbering ("2.1.3", every node counts) and the ancestor counts
// drive the per-level row styles (title bands darker per TITLE level, object
// rows greyer per OBJECT nesting level).
export function getBusinessObjectsTreeDisplayMeta(flatTree) {
  const path = []; // numbering counters per depth
  const stack = []; // per depth: {titleCount, objectCount} INCLUDING the node
  return flatTree.map(({ businessObject, depth }) => {
    // numbering
    if (path.length >= depth + 1) {
      path.length = depth + 1;
      path[depth] += 1;
    } else {
      path.push(1);
    }
    // ancestors
    stack.length = depth;
    const parent = stack[depth - 1] ?? { titleCount: 0, objectCount: 0 };
    const isTitle = Boolean(businessObject.isTitle);
    stack[depth] = {
      titleCount: parent.titleCount + (isTitle ? 1 : 0),
      objectCount: parent.objectCount + (isTitle ? 0 : 1),
    };
    return {
      number: path.join("."),
      titleAncestors: parent.titleCount,
      objectAncestors: parent.objectCount,
    };
  });
}

export function getBusinessObjectDescendants(
  businessObjects,
  businessObjectId
) {
  const childrenByParentId = buildBusinessObjectsChildrenMap(businessObjects);

  const descendants = [];
  const visited = new Set(); // cycle guard
  const visit = (id) => {
    (childrenByParentId[id] ?? []).forEach((child) => {
      if (visited.has(child.id)) return;
      visited.add(child.id);
      descendants.push(child);
      visit(child.id);
    });
  };
  visit(businessObjectId);

  return descendants;
}

// Ancestors of an object, root first, parent last (Krnet getAncestorPath).
// Stops on an unknown parent or a cycle.
export function getBusinessObjectAncestors(businessObjects, businessObjectId) {
  const byId = {};
  (businessObjects ?? []).forEach((o) => {
    byId[o.id] = o;
  });
  const ancestors = [];
  const seen = new Set([businessObjectId]);
  let current = byId[businessObjectId];
  while (current?.parentId && byId[current.parentId]) {
    const parent = byId[current.parentId];
    if (seen.has(parent.id)) break;
    seen.add(parent.id);
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}
