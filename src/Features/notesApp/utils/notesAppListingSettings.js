// Krnet (notes-app) listing configuration helpers — ports of the mobile
// app's src/utils/listingModel.js + the config screens' rules, so the
// `listing.notesApp.settings` object stored in Bimboxa keeps EXACTLY the
// Krnet keys and semantics (boolean keys deleted when false, defaults never
// persisted, `classifications` mirrored from the category fields...).
//
// Listing references (nomenclatureListingId, targetListingId,
// sourceListingIds, autoCode.nomenclatureListingId) hold LOCAL Bimboxa
// listing ids; they are remapped at sync time (remapNotesAppListingRefs).
//
// Pure module: no React, no Dexie (replayable in node).

// --- field types (authoritative list = Krnet FieldEditorScreen)

export const FIELD_TYPES = [
  { type: "photo", label: "Photo", desc: "Photo principale de l’objet" },
  { type: "category", label: "Catégorie", desc: "Valeur d’une nomenclature" },
  { type: "state", label: "État", desc: "Valeur d’une liste d’état" },
  {
    type: "linkSingle",
    label: "Lien unique",
    desc: "Un objet d’une autre liste",
  },
  {
    type: "linkMulti",
    label: "Liens multiples",
    desc: "Plusieurs objets d’une liste",
  },
  {
    type: "linkIndirect",
    label: "Liens indirects",
    desc: "Objets liés via les objets liés (lecture seule)",
  },
  { type: "location", label: "Localisation", desc: "Position sur un plan" },
  { type: "freeText", label: "Texte libre", desc: "Texte multi-lignes" },
];

export const TYPE_LABELS = {
  name: "Nom de l'objet",
  photo: "Photo principale",
  category: "Catégorie",
  linkSingle: "Lien unique",
  linkMulti: "Liens multiples",
  linkIndirect: "Liens indirects",
  location: "Sur un plan",
  freeText: "Texte libre",
  state: "État",
};

export const CARD_TEXT_FIELD_TYPES = [
  "freeText",
  "category",
  "state",
  "linkSingle",
  "linkMulti",
];
export const MAP_CARD_DEFAULTS = {
  avatar: "photo",
  primary: "name",
  secondary: "code",
};
const CARD_TYPE_LABELS = {
  freeText: "Texte libre",
  category: "Catégorie",
  state: "État",
  linkSingle: "Objet lié",
  linkMulti: "Objet lié",
};

export const DANGLING_REF_LABEL = "— supprimée —";
export const IGNORED_REF_LABEL = "— liste non synchronisée —";

// --- settings access

export function parseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

export function getNotesAppSettings(listing) {
  return parseSettings(listing?.notesApp?.settings);
}

// The legacy "name" field is not a field any more in Krnet (handled by the
// codification + rename): stripped on read, re-persisted lazily.
export function stripLegacyNameField(settings) {
  const s = parseSettings(settings);
  if (!Array.isArray(s.fields)) return s;
  const cleaned = s.fields.filter((f) => f?.type !== "name");
  if (cleaned.length === s.fields.length) return s;
  return { ...s, fields: cleaned };
}

export function getFields(settings) {
  const s = parseSettings(settings);
  return Array.isArray(s.fields)
    ? s.fields.filter((f) => f?.type !== "name")
    : [];
}

// --- derived mirror: settings.classifications from the category fields

export function syncDerivedFromFields(settings, fields) {
  const s = parseSettings(settings);
  const classifications = (fields || [])
    .filter((f) => f?.type === "category" && f.nomenclatureListingId)
    .map((f) => ({
      nomenclatureListingId: f.nomenclatureListingId,
      label: f.label || "",
      required: !!f.required,
    }));
  const next = { ...s, fields: fields || [] };
  if (classifications.length) next.classifications = classifications;
  else delete next.classifications;
  return next;
}

export function getClassifications(settings) {
  const s = parseSettings(settings);
  const arr = Array.isArray(s.classifications) ? s.classifications : [];
  return arr.filter((c) => c && c.nomenclatureListingId);
}

// --- map label / map card

export function getMapLabelOptions(fields) {
  return [
    { value: "name", label: "Nom" },
    { value: "code", label: "Code" },
    ...(fields || [])
      .filter((f) => f.type === "freeText")
      .map((f) => ({ value: f.id, label: f.label || "Texte libre" })),
  ];
}

export function getMapCardSetting(settings) {
  const s = parseSettings(settings);
  const stored = s.mapCard && typeof s.mapCard === "object" ? s.mapCard : {};
  return { ...MAP_CARD_DEFAULTS, ...stored };
}

export function getMapCardTextOptions(fields) {
  return [
    { value: "name", label: "Nom" },
    { value: "code", label: "Code" },
    ...(fields || [])
      .filter((f) => CARD_TEXT_FIELD_TYPES.includes(f.type))
      .map((f) => ({
        value: f.id,
        label: f.label || CARD_TYPE_LABELS[f.type],
        type: f.type,
      })),
  ];
}

// --- setters (Krnet "delete when default" semantics)

export function setBooleanSetting(settings, key, value) {
  const next = { ...parseSettings(settings) };
  if (value) next[key] = true;
  else delete next[key];
  return next;
}

export function setItemName(settings, value) {
  const next = { ...parseSettings(settings) };
  if (value && value.trim()) next.itemName = value;
  else delete next.itemName;
  return next;
}

export function setIncrementalNaming(settings, enabled) {
  const next = { ...parseSettings(settings) };
  next.incrementalNaming = !!enabled;
  if (!enabled) delete next.incrementalFirstName;
  return next;
}

export function setIncrementalFirstName(settings, value) {
  return { ...parseSettings(settings), incrementalFirstName: value ?? "" };
}

export function setMapLabel(settings, value) {
  const next = { ...parseSettings(settings) };
  if (value && value !== "name") next.mapLabel = value;
  else delete next.mapLabel;
  return next;
}

// Only the keys differing from the defaults are stored.
export function setMapCard(settings, key, value) {
  const s = parseSettings(settings);
  const current = { ...getMapCardSetting(s), [key]: value };
  const stored = {};
  for (const k of ["avatar", "primary", "secondary"]) {
    if (current[k] && current[k] !== MAP_CARD_DEFAULTS[k])
      stored[k] = current[k];
  }
  const next = { ...s };
  if (Object.keys(stored).length) next.mapCard = stored;
  else delete next.mapCard;
  return next;
}

// --- auto code

export const DEFAULT_AUTO_CODE_SUFFIX = "-001";

// Krnet keeps the whole conf when disabled (re-enable without reconfiguring).
export function setAutoCode(settings, patch) {
  const s = parseSettings(settings);
  const current =
    s.autoCode && typeof s.autoCode === "object" ? s.autoCode : {};
  return { ...s, autoCode: { ...current, ...patch } };
}

// null when disabled or absent (Krnet getAutoCodeConfig).
export function getAutoCodeConfig(settings) {
  const s = parseSettings(settings);
  const ac = s.autoCode;
  if (!ac || !ac.enabled) return null;
  return {
    enabled: true,
    firstSuffix:
      typeof ac.firstSuffix === "string" && ac.firstSuffix.length > 0
        ? ac.firstSuffix
        : DEFAULT_AUTO_CODE_SUFFIX,
    nomenclatureListingId: ac.nomenclatureListingId || null,
    templateKey: ac.templateKey || null,
  };
}

// --- fields

export function newFieldId() {
  return `f${Date.now()}`;
}

// Krnet FieldEditorScreen.buildField: only the keys of the picked type.
export function buildField(draft) {
  const type = draft.type;
  const field = {
    id: draft.id || newFieldId(),
    type,
    label: (draft.label || "").trim(),
  };
  if (type !== "linkIndirect") field.required = !!draft.required;
  if (type === "category") {
    field.nomenclatureListingId = draft.nomenclatureListingId ?? null;
  } else if (type === "linkSingle" || type === "linkMulti") {
    field.targetListingId = draft.targetListingId ?? null;
    field.readOnly = !!draft.readOnly;
  } else if (type === "linkIndirect") {
    field.targetListingId = draft.targetListingId ?? null;
    field.sourceListingIds = Array.isArray(draft.sourceListingIds)
      ? draft.sourceListingIds
      : [];
  } else if (type === "state") {
    field.stateModelId = draft.stateModelId ?? null;
  }
  return field;
}

export function isFieldValid(draft) {
  if (!draft?.label || !draft.label.trim()) return false;
  const type = draft.type;
  if (type === "category" && !draft.nomenclatureListingId) return false;
  if ((type === "linkSingle" || type === "linkMulti") && !draft.targetListingId)
    return false;
  if (type === "linkIndirect" && !draft.targetListingId) return false;
  if (type === "state" && !draft.stateModelId) return false;
  return true;
}

// Auto title while the user has not typed a label (Krnet applyAutoTitle).
export function getAutoTitle(type, { listingName, stateModelName } = {}) {
  if (type === "photo") return "Photo";
  if (type === "location") return "Localisation";
  if (type === "freeText") return "Texte libre";
  if (type === "category") return listingName || "Catégorie";
  if (type === "linkSingle" || type === "linkMulti")
    return listingName || "Lien";
  if (type === "linkIndirect") return listingName || "Liens indirects";
  if (type === "state") return stateModelName || "État";
  return "";
}

function refName(id, { listingById, ignoredRemoteIds }) {
  const name = listingById?.[id]?.name;
  if (name) return name;
  if (ignoredRemoteIds?.has?.(id)) return IGNORED_REF_LABEL;
  return DANGLING_REF_LABEL;
}

// Row summary of the fields list (Krnet ConfigEntityModelScreen.fieldSummary).
export function getFieldSummary(field, ctx = {}) {
  const { stateModelById } = ctx;
  switch (field?.type) {
    case "name":
      return TYPE_LABELS.name;
    case "photo":
      return TYPE_LABELS.photo;
    case "category": {
      const n = refName(field.nomenclatureListingId, ctx);
      return `Catégorie · ${n}${field.required ? " · obligatoire" : ""}`;
    }
    case "linkSingle":
    case "linkMulti": {
      const n = refName(field.targetListingId, ctx);
      const kind =
        field.type === "linkSingle" ? "lien unique" : "liens multiples";
      return `${n} · ${kind}${field.readOnly ? " · lecture seule" : ""}`;
    }
    case "linkIndirect": {
      const n = refName(field.targetListingId, ctx);
      const srcs = (field.sourceListingIds || [])
        .map((id) => ctx.listingById?.[id]?.name)
        .filter(Boolean);
      return `Liens indirects · ${n}${srcs.length ? ` (via ${srcs.join(", ")})` : ""}`;
    }
    case "location":
      return TYPE_LABELS.location;
    case "freeText":
      return `Texte libre${field.required ? " · obligatoire" : ""}`;
    case "state": {
      const sm = stateModelById?.[field.stateModelId];
      return `État · ${sm?.name || DANGLING_REF_LABEL}`;
    }
    default:
      return "";
  }
}

// Every listing id referenced by a settings object (push closure).
export function collectNotesAppListingRefs(settings) {
  const s = parseSettings(settings);
  const ids = new Set();
  for (const f of Array.isArray(s.fields) ? s.fields : []) {
    if (f?.nomenclatureListingId) ids.add(f.nomenclatureListingId);
    if (f?.targetListingId) ids.add(f.targetListingId);
    for (const id of Array.isArray(f?.sourceListingIds)
      ? f.sourceListingIds
      : []) {
      if (id) ids.add(id);
    }
  }
  for (const c of Array.isArray(s.classifications) ? s.classifications : []) {
    if (c?.nomenclatureListingId) ids.add(c.nomenclatureListingId);
  }
  if (s.autoCode?.nomenclatureListingId)
    ids.add(s.autoCode.nomenclatureListingId);
  return [...ids];
}
