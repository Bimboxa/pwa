// Values of the listing-model fields (Krnet "Modèle de fiche",
// `listing.notesApp.settings.fields`) on a business object.
//
// Two layers:
// - `businessObject.fieldValues = {[fieldId]: value}` — the values edited in
//   Bimboxa (Fiche tab). Shapes: freeText → string, state → state id,
//   category → LOCAL id of the nomenclature object, linkSingle → LOCAL
//   object id, linkMulti → LOCAL object ids.
// - `businessObject.notesAppRemote` — the Krnet snapshot written by the
//   pull (freeText under `fields`, states under `stateValues`, categories
//   under `settings.categories` keyed by the REMOTE nomenclature listing id
//   with REMOTE object ids; links are not pulled).
// The effective value is the local one when set, else the remote one
// mapped to local ids. A pull that brings a newer remote row drops the
// local layer (row-level last-modified-wins, see
// mergeNotesAppBusinessObjects).
//
// ctx = {
//   stateModelById,             // listing state models (tombstones included)
//   remoteListingIdByLocalId,   // local listing id -> listing.idMaster
//   categoryLocalIdByIdMaster,  // remote object id -> local object id
//   objectById,                 // local object id -> {label, code, ...}
// }
//
// Pure module: no React, no Dexie (replayable in node).

export const EDITABLE_FIELD_TYPES = [
  "freeText",
  "state",
  "category",
  "linkSingle",
  "linkMulti",
];

function hasLocalValue(businessObject, fieldId) {
  const values = businessObject?.fieldValues;
  return (
    values &&
    typeof values === "object" &&
    Object.prototype.hasOwnProperty.call(values, fieldId)
  );
}

function getRemoteValue(businessObject, field, ctx) {
  const remote = businessObject?.notesAppRemote ?? {};
  switch (field.type) {
    case "freeText": {
      const value = remote.fields?.[field.id];
      return value == null ? "" : String(value);
    }
    case "state":
      return remote.stateValues?.[field.stateModelId] ?? null;
    case "category": {
      const remoteListingId =
        ctx?.remoteListingIdByLocalId?.[field.nomenclatureListingId];
      if (!remoteListingId) return null;
      const remoteObjectId = remote.settings?.categories?.[remoteListingId];
      if (!remoteObjectId) return null;
      return ctx?.categoryLocalIdByIdMaster?.[remoteObjectId] ?? null;
    }
    case "linkMulti":
      return [];
    default:
      return null;
  }
}

// Effective value of a field: local edit first, else the Krnet snapshot.
export function getBusinessObjectFieldValue(businessObject, field, ctx) {
  if (!field) return null;
  if (hasLocalValue(businessObject, field.id)) {
    const value = businessObject.fieldValues[field.id];
    if (field.type === "linkMulti") return Array.isArray(value) ? value : [];
    return value ?? (field.type === "freeText" ? "" : null);
  }
  return getRemoteValue(businessObject, field, ctx);
}

function getObjectText(object, mode) {
  if (!object) return "";
  return mode === "code" ? (object.code ?? "") : (object.label ?? "");
}

// Display text of a field value ("" when unset). `mode: "code"` reads the
// code of the linked object (link fields only, Krnet `<fieldId>:code`).
export function getBusinessObjectFieldText(
  businessObject,
  field,
  ctx,
  { mode = "name" } = {}
) {
  if (!field) return "";
  const value = getBusinessObjectFieldValue(businessObject, field, ctx);
  switch (field.type) {
    case "freeText":
      return value ?? "";
    case "state": {
      if (!value) return "";
      const stateModel = ctx?.stateModelById?.[field.stateModelId];
      const state = (stateModel?.states ?? []).find((s) => s?.id === value);
      return state?.name ?? "";
    }
    case "category":
    case "linkSingle":
      return value ? getObjectText(ctx?.objectById?.[value], mode) : "";
    case "linkMulti":
      return (value ?? [])
        .map((id) => getObjectText(ctx?.objectById?.[id], mode))
        .filter(Boolean)
        .join(", ");
    default:
      return "";
  }
}

// New `fieldValues` map with one value set; an empty value removes the key
// (the remote snapshot shows through again).
export function setBusinessObjectFieldValue(fieldValues, fieldId, value) {
  const next = { ...(fieldValues ?? {}) };
  const empty =
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (empty) delete next[fieldId];
  else next[fieldId] = value;
  return next;
}

// Listings whose objects a set of fields reference (category nomenclatures,
// link targets) — the objects to index in the resolution context.
export function getFieldsReferencedListingIds(fields) {
  const ids = new Set();
  for (const f of fields ?? []) {
    if (f?.type === "category" && f.nomenclatureListingId) {
      ids.add(f.nomenclatureListingId);
    } else if (
      (f?.type === "linkSingle" || f?.type === "linkMulti") &&
      f.targetListingId
    ) {
      ids.add(f.targetListingId);
    }
  }
  return [...ids];
}
