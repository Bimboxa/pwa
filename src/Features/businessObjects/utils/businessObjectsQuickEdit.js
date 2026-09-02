import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import buildBusinessObjectsTree from "./buildBusinessObjectsTree";
import { DEFAULT_BUSINESS_OBJECT_COLOR } from "../constants/businessObjectEntityModel";

// ---------------------------------------------------------------------------
// Quick text edition of a business-objects tree.
//
// Text format: one row per line, one leading TAB per depth level (runs of
// 2 spaces are tolerated). Trailing suffix:
// - unit in parentheses → object row: (m) → L, (m2) → S, (u) → U;
// - unit in BRACKETS → TITLE row: [m2], or [] for a unit-less title;
// - no suffix (or empty parentheses) → unit-less object row.
//
//   Gros œuvre []
//   \tCuvelage [m2]
//   \t\tVoiles (m2)
//   \t\tRadier (m2)
//   Joints (m)
//
// serialize → parse → diff (label matching + positional rename pairing + LIS
// order detection) → plan {additions, updates, deletionIds} applied in one
// transaction by applyBusinessObjectsQuickEditService.
// ---------------------------------------------------------------------------

const UNIT_TO_TOKEN = { U: "u", L: "m", S: "m2" };
const TOKEN_TO_UNIT = { u: "U", m: "L", ml: "L", m2: "S", "m²": "S" };

export function serializeBusinessObjectsTree(businessObjects) {
  const flatTree = buildBusinessObjectsTree(businessObjects);
  return flatTree
    .map(({ businessObject, depth }) => {
      const token = UNIT_TO_TOKEN[businessObject.unit] ?? null;
      const suffix = businessObject.isTitle
        ? ` [${token ?? ""}]`
        : token
          ? ` (${token})`
          : "";
      return `${"\t".repeat(depth)}${businessObject.label}${suffix}`;
    })
    .join("\n");
}

// → [{label, unit|null, isTitle, depth, parentIndex|null}] — parentIndex
// points into the returned array. Depth jumps are clamped to parent+1; empty
// lines are skipped.
export function parseBusinessObjectsText(text) {
  const items = [];
  const stack = []; // [{depth, index}]

  for (const rawLine of (text ?? "").split("\n")) {
    // leading whitespace → depth (1 tab = 1 level, 2 spaces = 1 level)
    const leading = rawLine.match(/^[\t ]*/)[0];
    let depth = 0;
    let spaces = 0;
    for (const ch of leading) {
      if (ch === "\t") depth += 1;
      else spaces += 1;
    }
    depth += Math.floor(spaces / 2);

    const body = rawLine.trim();
    if (!body) continue;

    // trailing suffix: (unit) → object row, [unit] / [] → title row
    let label = body;
    let unit = null;
    let isTitle = false;
    const parenMatch = body.match(/^(.*?)\s*\(\s*(m2|m²|ml|m|u)?\s*\)$/i);
    const bracketMatch = body.match(/^(.*?)\s*\[\s*(m2|m²|ml|m|u)?\s*\]$/i);
    const suffixMatch = bracketMatch ?? parenMatch;
    if (suffixMatch) {
      label = suffixMatch[1].trim();
      unit = suffixMatch[2]
        ? (TOKEN_TO_UNIT[suffixMatch[2].toLowerCase()] ?? null)
        : null;
      isTitle = Boolean(bracketMatch);
    }
    if (!label) continue;

    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    const clampedDepth = parent ? Math.min(depth, parent.depth + 1) : 0;

    const index = items.length;
    items.push({
      label,
      unit,
      isTitle,
      depth: clampedDepth,
      parentIndex: parent?.index ?? null,
    });
    stack.push({ depth: clampedDepth, index });
  }

  return items;
}

// Positions (in `values`) of one longest non-decreasing subsequence — the
// stable anchors of the order detection (O(n²), sibling lists are small).
function getLisPositionSet(values) {
  const n = values.length;
  if (n === 0) return new Set();
  const lengths = new Array(n).fill(1);
  const prevs = new Array(n).fill(-1);
  let bestEnd = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (values[j] <= values[i] && lengths[j] + 1 > lengths[i]) {
        lengths[i] = lengths[j] + 1;
        prevs[i] = j;
      }
    }
    if (lengths[i] > lengths[bestEnd]) bestEnd = i;
  }
  const set = new Set();
  for (let i = bestEnd; i !== -1; i = prevs[i]) set.add(i);
  return set;
}

/*
 * Diff between the listing's current tree and the parsed text.
 *
 * Matching: 1) same parent label + same label, 2) same label anywhere,
 * 3) leftovers paired positionally (→ renames). Unpaired lines are additions,
 * unpaired objects deletions.
 *
 * Returns {changes, plan, count}:
 * - changes: [{kinds: ["ADD"|"DELETE"|"RENAME"|"MOVE"|"ORDER"|"UNIT"],
 *    label, businessObjectId?, from?}] in display order,
 * - plan: {additions (full rows), updates ([{id, patch}]), deletionIds}.
 */
export function buildQuickEditDiff({ listing, businessObjects, text }) {
  const lines = parseBusinessObjectsText(text);
  const flatTree = buildBusinessObjectsTree(businessObjects ?? []);
  const objectById = {};
  (businessObjects ?? []).forEach((o) => {
    objectById[o.id] = o;
  });

  // --- matching -----------------------------------------------------------

  const oldOrder = flatTree.map(({ businessObject }) => businessObject);
  const matchedObjectIdByLine = new Array(lines.length).fill(null);
  const usedOldIds = new Set();

  const oldParentLabel = (o) => objectById[o.parentId]?.label ?? "";
  const lineParentLabel = (l) =>
    l.parentIndex != null ? lines[l.parentIndex].label : "";

  const matchPass = (getOldKey, getLineKey) => {
    const pool = new Map(); // key -> [object] in tree order
    oldOrder.forEach((o) => {
      if (usedOldIds.has(o.id)) return;
      const key = getOldKey(o);
      if (!pool.has(key)) pool.set(key, []);
      pool.get(key).push(o);
    });
    lines.forEach((line, i) => {
      if (matchedObjectIdByLine[i]) return;
      const candidates = pool.get(getLineKey(line));
      const object = candidates?.find((o) => !usedOldIds.has(o.id));
      if (object) {
        matchedObjectIdByLine[i] = object.id;
        usedOldIds.add(object.id);
      }
    });
  };

  matchPass(
    (o) => `${oldParentLabel(o)}::${o.label}`,
    (l) => `${lineParentLabel(l)}::${l.label}`
  );
  matchPass(
    (o) => o.label,
    (l) => l.label
  );

  // pass 3a: positional pairing of leftovers WITHIN the same parent → renames.
  // A line's parent object is its parent line's match ("ROOT" for top level;
  // a parent line that is itself an addition can host no rename pairing).
  const lineParentObjectKey = (l) => {
    if (l.parentIndex == null) return "ROOT";
    return matchedObjectIdByLine[l.parentIndex] ?? null;
  };
  {
    const oldsByParent = new Map(); // parentKey -> [object] in tree order
    oldOrder.forEach((o) => {
      if (usedOldIds.has(o.id)) return;
      const key = o.parentId ?? "ROOT";
      if (!oldsByParent.has(key)) oldsByParent.set(key, []);
      oldsByParent.get(key).push(o);
    });
    lines.forEach((line, i) => {
      if (matchedObjectIdByLine[i]) return;
      const key = lineParentObjectKey(line);
      if (!key) return;
      const object = oldsByParent
        .get(key)
        ?.find((o) => !usedOldIds.has(o.id));
      if (object) {
        matchedObjectIdByLine[i] = object.id;
        usedOldIds.add(object.id);
      }
    });
  }

  // pass 3b: cross-parent positional pairing (rename + move in one edit) —
  // only when the leftover counts match exactly, so an addition somewhere
  // else can never be mistaken for a rename of an unrelated object.
  const leftoverOlds = oldOrder.filter((o) => !usedOldIds.has(o.id));
  const leftoverLineIdxs = lines
    .map((_, i) => i)
    .filter((i) => !matchedObjectIdByLine[i]);
  if (
    leftoverOlds.length > 0 &&
    leftoverOlds.length === leftoverLineIdxs.length
  ) {
    leftoverLineIdxs.forEach((lineIdx, k) => {
      const object = leftoverOlds[k];
      matchedObjectIdByLine[lineIdx] = object.id;
      usedOldIds.add(object.id);
    });
  }

  const deletionIds = oldOrder
    .filter((o) => !usedOldIds.has(o.id))
    .map((o) => o.id);

  // --- refs & additions (tree order: parents before children) -------------

  // ref of each line: matched object id, or a fresh id for an addition
  const refByLine = lines.map(
    (_, i) => matchedObjectIdByLine[i] ?? nanoid()
  );
  const additionRowByLine = {}; // lineIndex -> row (color/sortIndex set below)

  const parentRefOfLine = (i) =>
    lines[i].parentIndex != null ? refByLine[lines[i].parentIndex] : null;

  // color of a parent ref: existing object, or an addition row created on an
  // earlier line (lines are processed in document order, parents first).
  const additionRowByRef = {};
  const refColor = (ref) =>
    objectById[ref]?.color ?? additionRowByRef[ref]?.color ?? null;

  lines.forEach((line, i) => {
    if (matchedObjectIdByLine[i]) return;
    const parentRef = parentRefOfLine(i);
    const row = {
      id: refByLine[i],
      listingId: listing.id,
      projectId: listing.projectId,
      scopeId: listing.scopeId,
      parentId: parentRef,
      label: line.label,
      color: refColor(parentRef) ?? DEFAULT_BUSINESS_OBJECT_COLOR,
      // no suffix on the line = explicitly unit-less (null)
      unit: line.unit ?? null,
      ...(line.isTitle ? { isTitle: true } : {}),
      sortIndex: null, // assigned by the sibling pass below
    };
    additionRowByLine[i] = row;
    additionRowByRef[row.id] = row;
  });

  // --- per-object patches (label / unit / parent) --------------------------

  const patchById = {};
  const kindsByRef = {};
  const addKind = (ref, kind) => {
    if (!kindsByRef[ref]) kindsByRef[ref] = [];
    if (!kindsByRef[ref].includes(kind)) kindsByRef[ref].push(kind);
  };

  lines.forEach((line, i) => {
    const objectId = matchedObjectIdByLine[i];
    if (!objectId) {
      addKind(refByLine[i], "ADD");
      return;
    }
    const object = objectById[objectId];
    const patch = {};
    if (line.label !== object.label) {
      patch.label = line.label;
      addKind(objectId, "RENAME");
    }
    // the suffix is authoritative: no suffix = unit-less (null)
    if ((line.unit ?? null) !== (object.unit ?? null)) {
      patch.unit = line.unit ?? null;
      addKind(objectId, "UNIT");
    }
    if (Boolean(line.isTitle) !== Boolean(object.isTitle)) {
      patch.isTitle = Boolean(line.isTitle);
      addKind(objectId, "TITLE");
    }
    const newParentId = parentRefOfLine(i);
    if ((newParentId ?? null) !== (object.parentId ?? null)) {
      patch.parentId = newParentId ?? null;
      addKind(objectId, "MOVE");
    }
    if (Object.keys(patch).length > 0) patchById[objectId] = patch;
  });

  // --- sibling order: LIS anchors keep their sortIndex, the rest is
  // regenerated between anchors ---------------------------------------------

  const linesByParentRef = new Map(); // parentRef ("ROOT" for null) -> [lineIdx]
  lines.forEach((_, i) => {
    const key = parentRefOfLine(i) ?? "ROOT";
    if (!linesByParentRef.has(key)) linesByParentRef.set(key, []);
    linesByParentRef.get(key).push(i);
  });

  for (const lineIdxs of linesByParentRef.values()) {
    // stable candidates: matched objects that keep their parent
    const entries = lineIdxs.map((i) => {
      const objectId = matchedObjectIdByLine[i];
      const object = objectId ? objectById[objectId] : null;
      const keptParent =
        object && (patchById[objectId]?.parentId === undefined);
      return {
        ref: refByLine[i],
        lineIdx: i,
        isCandidate: Boolean(keptParent),
        oldSortIndex: object?.sortIndex ?? "",
      };
    });

    const candidatePositions = entries
      .map((e, pos) => (e.isCandidate ? pos : -1))
      .filter((pos) => pos !== -1);
    const lisSet = getLisPositionSet(
      candidatePositions.map((pos) => String(entries[pos].oldSortIndex))
    );
    const stablePositions = new Set(
      candidatePositions.filter((_, k) => lisSet.has(k))
    );

    let prevKey = null;
    entries.forEach((entry, pos) => {
      if (stablePositions.has(pos)) {
        prevKey = String(entry.oldSortIndex);
        return;
      }
      // next stable anchor after pos
      let nextKey = null;
      for (let p = pos + 1; p < entries.length; p++) {
        if (stablePositions.has(p)) {
          nextKey = String(entries[p].oldSortIndex);
          break;
        }
      }
      let sortIndex;
      try {
        sortIndex = generateKeyBetween(prevKey || null, nextKey || null);
      } catch {
        // colliding anchors (legacy data) — regenerate after prev only
        sortIndex = generateKeyBetween(prevKey || null, null);
      }
      prevKey = sortIndex;

      const objectId = matchedObjectIdByLine[entry.lineIdx];
      if (objectId) {
        if (!patchById[objectId]) patchById[objectId] = {};
        patchById[objectId].sortIndex = sortIndex;
        // A candidate outside the LIS really moved among its siblings; a
        // reparented object is already flagged MOVE (never a candidate).
        if (entry.isCandidate) addKind(objectId, "ORDER");
      } else {
        additionRowByLine[entry.lineIdx].sortIndex = sortIndex;
      }
    });
  }

  // --- result --------------------------------------------------------------

  const additions = lines
    .map((_, i) => additionRowByLine[i])
    .filter(Boolean);
  const updates = Object.entries(patchById).map(([id, patch]) => ({
    id,
    patch,
  }));

  const changes = [];
  lines.forEach((line, i) => {
    const ref = refByLine[i];
    const kinds = kindsByRef[ref] ?? [];
    if (!kinds.length) return;
    const objectId = matchedObjectIdByLine[i];
    changes.push({
      kinds,
      label: line.label,
      businessObjectId: objectId ?? null,
      from:
        objectId && kinds.includes("RENAME")
          ? objectById[objectId].label
          : null,
    });
  });
  deletionIds.forEach((id) => {
    changes.push({
      kinds: ["DELETE"],
      label: objectById[id].label,
      businessObjectId: id,
      from: null,
    });
  });

  return {
    changes,
    count: changes.length,
    plan: { additions, updates, deletionIds },
  };
}
