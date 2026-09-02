// Builds a flattened tree from flat business-object rows:
// [{businessObject, depth}], siblings ordered by fractional sortIndex,
// children right after their parent (depth-first). Orphan objects
// (deleted/missing parent) are treated as roots.

export default function buildBusinessObjectsTree(businessObjects) {
  if (!businessObjects?.length) return [];

  const ids = new Set(businessObjects.map((o) => o.id));

  const childrenByParentId = {};
  businessObjects.forEach((object) => {
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

  const flat = [];
  const visit = (parentKey, depth) => {
    const siblings = childrenByParentId[parentKey] ?? [];
    siblings.forEach((object) => {
      flat.push({ businessObject: object, depth });
      visit(object.id, depth + 1);
    });
  };
  visit("ROOT", 0);

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

export function getBusinessObjectDescendants(businessObjects, businessObjectId) {
  const childrenByParentId = {};
  businessObjects.forEach((object) => {
    const parentKey = object.parentId ?? "ROOT";
    if (!childrenByParentId[parentKey]) childrenByParentId[parentKey] = [];
    childrenByParentId[parentKey].push(object);
  });

  const descendants = [];
  const visit = (id) => {
    (childrenByParentId[id] ?? []).forEach((child) => {
      descendants.push(child);
      visit(child.id);
    });
  };
  visit(businessObjectId);

  return descendants;
}
