// Pure validation / normalization of the JSON pasted back from an external AI
// chat (Prompt IA of the business-objects listings).
//
// Input: {version, listingName?, note?, businessObjects: [{id, parentId,
// label, code?, isTitle?, unit?, refQty?, description?}]} — a FLAT
// list in document order, hierarchy by author `parentId`.
//
// `unit` is a free text, kept as written in the source document ("Ens.",
// "M²", "kg"...). Former outputs carried the source unit in `refUnit` next to
// an enum `unit` ("U" / "L" / "S"): `refUnit` wins, the enum keys are read as
// u / ml / m².

import { getBusinessObjectUnitText } from "./getBusinessObjectQtyKind.js";

// "1 234,5" / "404" / 12 → number | null
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

function toText(value) {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

/**
 * @param {Object} json the object extracted from the pasted text
 * @returns {{ok: boolean, error: string|null,
 *   items: Array<{ref: string, parentRef: string|null, depth: number,
 *     label: string, isTitle: boolean, unit: string|null,
 *     code: string|null, refQty: number|null,
 *     description: string|null}>,
 *   warnings: string[], note: string|null, listingName: string|null,
 *   counts: {objects: number, titles: number}}}
 */
export default function parsePromptIaBusinessObjects(json) {
  const fail = (error) => ({
    ok: false,
    error,
    items: [],
    warnings: [],
    note: null,
    listingName: null,
    counts: { objects: 0, titles: 0 },
  });

  if (!json || typeof json !== "object" || Array.isArray(json))
    return fail("Le JSON doit être un objet.");
  const list = json.businessObjects;
  if (!Array.isArray(list))
    return fail("Clé `businessObjects` absente : un tableau est attendu.");
  if (list.length === 0) return fail("`businessObjects` est vide.");

  const warnings = [];
  const items = [];
  const refs = new Set();
  let skipped = 0;

  list.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      skipped += 1;
      return;
    }
    const label = toText(raw.label);
    if (!label) {
      skipped += 1;
      return;
    }
    // author id: optional, made unique
    let ref = toText(raw.id) ?? `#${index}`;
    if (refs.has(ref)) {
      warnings.push(`Identifiant dupliqué « ${ref} » (« ${label} »).`);
      ref = `${ref}#${index}`;
    }
    refs.add(ref);

    const isTitle = raw.isTitle === true;
    const unit =
      toText(raw.refUnit) ??
      (getBusinessObjectUnitText(toText(raw.unit)) || null);

    items.push({
      ref,
      parentRef: toText(raw.parentId),
      depth: 0,
      label,
      isTitle,
      unit,
      code: toText(raw.code),
      refQty: toNumber(raw.refQty),
      description: toText(raw.description),
    });
  });

  if (items.length === 0)
    return fail("Aucun élément valide : chaque élément doit avoir un `label`.");
  if (skipped > 0)
    warnings.push(`${skipped} élément(s) sans libellé ignoré(s).`);

  // parents: unknown → root
  const itemByRef = new Map(items.map((item) => [item.ref, item]));
  let unknownParents = 0;
  items.forEach((item) => {
    if (item.parentRef == null) return;
    if (!itemByRef.has(item.parentRef) || item.parentRef === item.ref) {
      item.parentRef = null;
      unknownParents += 1;
    }
  });
  if (unknownParents > 0)
    warnings.push(
      `${unknownParents} élément(s) avec un parent inconnu, placé(s) à la racine.`
    );

  // depth + cycle detection
  for (const item of items) {
    let depth = 0;
    let cursor = item;
    const seen = new Set([item.ref]);
    while (cursor.parentRef != null) {
      cursor = itemByRef.get(cursor.parentRef);
      if (seen.has(cursor.ref))
        return fail(
          `Hiérarchie circulaire autour de « ${item.label} » (parentId).`
        );
      seen.add(cursor.ref);
      depth += 1;
    }
    item.depth = depth;
  }

  // display order: depth-first, siblings in document order (a child listed
  // before or far from its parent is brought back under it).
  const childrenByParent = new Map();
  items.forEach((item) => {
    const key = item.parentRef ?? "";
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(item);
  });
  const ordered = [];
  const visit = (key) => {
    for (const child of childrenByParent.get(key) ?? []) {
      ordered.push(child);
      visit(child.ref);
    }
  };
  visit("");

  const titles = ordered.filter((item) => item.isTitle).length;

  return {
    ok: true,
    error: null,
    items: ordered,
    warnings,
    note: toText(json.note),
    listingName: toText(json.listingName),
    counts: { objects: ordered.length - titles, titles },
  };
}
