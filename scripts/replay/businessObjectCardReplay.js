// Node replay of the business-object field values (listing-model fields:
// local edits over the Krnet snapshot) and of the card resolver (Krnet
// `mapCard` / `listCard` preview of the list rows): text sources,
// fallbacks, avatar photo pick.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/businessObjectCardReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/businessObjectCardReplay.mjs && node /tmp/businessObjectCardReplay.mjs
//
// Exits 1 on any failure.
/* global process */

import resolveBusinessObjectCard, {
  pickBusinessObjectMainPhotoNote,
  resolveBusinessObjectCardText,
} from "Features/businessObjects/utils/resolveBusinessObjectCard";
import { DEFAULT_BUSINESS_OBJECT_COLOR } from "Features/businessObjects/constants/businessObjectEntityModel";
import {
  getBusinessObjectFieldValue,
  getBusinessObjectFieldText,
  setBusinessObjectFieldValue,
  getFieldsReferencedListingIds,
} from "Features/businessObjects/utils/businessObjectFieldValues";

let failures = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const fields = [
  { id: "ft", type: "freeText", label: "Note" },
  { id: "st", type: "state", label: "Avancement", stateModelId: "sm1" },
  {
    id: "cat",
    type: "category",
    label: "Matériau",
    nomenclatureListingId: "L_NOM",
  },
  { id: "ln", type: "linkSingle", label: "Site", targetListingId: "L2" },
  { id: "ph", type: "photo", label: "Photo" },
];
const ctx = {
  fields,
  mapCard: { avatar: "photo", primary: "name", secondary: "code" },
  stateModelById: {
    sm1: { id: "sm1", states: [{ id: "s_ok", name: "Fait" }] },
  },
  remoteListingIdByLocalId: { L_NOM: "R_NOM" },
  categoryLocalIdByIdMaster: { r_cat_1: "cat_1" },
  objectById: {
    cat_1: { id: "cat_1", label: "Béton", code: "BET" },
    cat_2: { id: "cat_2", label: "Acier", code: "ACI" },
    site_1: { id: "site_1", label: "Site A", code: "SA" },
    site_2: { id: "site_2", label: "Site B", code: "SB" },
  },
  listingColor: "#123456",
  avatarUrl: "blob:thumb",
};
const bo = {
  id: "bo1",
  label: "Poteau P1",
  code: "P-001",
  color: "#abcdef",
  notesAppRemote: {
    name: "Poteau P1",
    code: "P-001",
    fields: { ft: "Fissure visible", ph: "note_field_photo" },
    stateValues: { sm1: "s_ok" },
    settings: {
      mainPhotoNoteId: "note_main",
      categories: { R_NOM: "r_cat_1" },
    },
  },
  notesAppNotes: [
    { idMaster: "note_field_photo", type: "photo", fileName: "f_field.jpg" },
    { idMaster: "note_first", type: "photo", fileName: "f_first.jpg" },
    { idMaster: "note_main", type: "photo", fileName: "f_main.jpg" },
    { idMaster: "note_audio", type: "audio", fileName: "a.m4a" },
  ],
};
const local = { id: "bo2", label: "Local", color: null };

console.log("card text sources");
const text = (src, o = bo, c = ctx) => resolveBusinessObjectCardText(o, src, c);
check("name", text("name") === "Poteau P1");
check("code", text("code") === "P-001");
check("freeText", text("ft") === "Fissure visible");
check("state known", text("st") === "Fait");
check(
  "state unknown → empty",
  text("st", { ...bo, notesAppRemote: { stateValues: { sm1: "zz" } } }) === ""
);
check("category linked", text("cat") === "Béton");
check(
  "category unlinked nomenclature → empty",
  text("cat", bo, { ...ctx, remoteListingIdByLocalId: {} }) === ""
);
check("link → empty (not pulled)", text("ln") === "" && text("ln:code") === "");
const boLocal = {
  ...bo,
  fieldValues: { ft: "Édité", st: "zz", cat: "cat_2", ln: "site_1" },
};
check("local freeText wins", text("ft", boLocal) === "Édité");
check("local unknown state → empty", text("st", boLocal) === "");
check("local category wins", text("cat", boLocal) === "Acier");
check(
  "local link name / code",
  text("ln", boLocal) === "Site A" && text("ln:code", boLocal) === "SA"
);
check(
  "local empty freeText shows empty (not remote)",
  text("ft", { ...bo, fieldValues: { ft: "" } }) === ""
);
check("photo field → empty", text("ph") === "");
check("deleted field → empty", text("gone") === "");
check("none → empty", text("none") === "");
check("local object name", text("name", local) === "Local");
check("local object code → empty", text("code", local) === "");

console.log("resolveBusinessObjectCard");
const card = resolveBusinessObjectCard(bo, ctx);
check(
  "defaults: name + code",
  card.primary === "Poteau P1" && card.secondary === "P-001"
);
check("initial from primary", card.initial === "P");
check("object color wins", card.color === "#abcdef");
check("avatar url passed", card.avatarUrl === "blob:thumb");
const cardLink = resolveBusinessObjectCard(bo, {
  ...ctx,
  mapCard: { primary: "ln", secondary: "none" },
});
check(
  "link primary falls back to name, none secondary empty",
  cardLink.primary === "Poteau P1" && cardLink.secondary === ""
);
const cardLocal = resolveBusinessObjectCard(local, ctx);
check(
  "local object: name, empty secondary in row mode",
  cardLocal.primary === "Local" && cardLocal.secondary === ""
);
check("local object color → listing color", cardLocal.color === "#123456");
check(
  "no listing color → default",
  resolveBusinessObjectCard(local, { ...ctx, listingColor: null }).color ===
    DEFAULT_BUSINESS_OBJECT_COLOR
);
check(
  "map card mode: empty secondary → listing name",
  resolveBusinessObjectCard(local, ctx, { row: false, listingName: "Poteaux" })
    .secondary === "Poteaux"
);
check(
  "empty name → ? initial",
  resolveBusinessObjectCard({ label: "" }, ctx).initial === "?"
);
check(
  "avatar none → null url",
  resolveBusinessObjectCard(bo, { ...ctx, mapCard: { avatar: "none" } })
    .avatarUrl === null
);
check(
  "stale secondary field → default code",
  resolveBusinessObjectCard(bo, { ...ctx, mapCard: { secondary: "gone" } })
    .secondary === "P-001"
);
check(
  "state as secondary",
  resolveBusinessObjectCard(bo, { ...ctx, mapCard: { secondary: "st" } })
    .secondary === "Fait"
);

console.log("field values");
const fieldById = Object.fromEntries(fields.map((f) => [f.id, f]));
check(
  "value: remote category → local id",
  getBusinessObjectFieldValue(bo, fieldById.cat, ctx) === "cat_1"
);
check(
  "value: remote state id",
  getBusinessObjectFieldValue(bo, fieldById.st, ctx) === "s_ok"
);
check(
  "value: linkMulti defaults to []",
  eq(getBusinessObjectFieldValue(bo, fieldById.ln, ctx), null) &&
    eq(
      getBusinessObjectFieldValue(
        bo,
        { id: "lm", type: "linkMulti", targetListingId: "L2" },
        ctx
      ),
      []
    )
);
check(
  "text: linkMulti joins labels",
  getBusinessObjectFieldText(
    { fieldValues: { lm: ["site_1", "site_2", "gone"] } },
    { id: "lm", type: "linkMulti", targetListingId: "L2" },
    ctx
  ) === "Site A, Site B"
);
check(
  "setFieldValue: set / unset",
  eq(setBusinessObjectFieldValue({ a: 1 }, "b", "x"), { a: 1, b: "x" }) &&
    eq(setBusinessObjectFieldValue({ a: 1, b: "x" }, "b", ""), { a: 1 }) &&
    eq(setBusinessObjectFieldValue({ b: ["1"] }, "b", []), {}) &&
    eq(setBusinessObjectFieldValue(undefined, "b", null), {})
);
check(
  "referenced listings",
  eq(getFieldsReferencedListingIds(fields), ["L_NOM", "L2"])
);

console.log("main photo pick");
check(
  "mainPhotoNoteId wins",
  pickBusinessObjectMainPhotoNote(bo)?.fileName === "f_main.jpg"
);
check(
  "without mainPhotoNoteId: first free photo (field photo excluded)",
  pickBusinessObjectMainPhotoNote({
    ...bo,
    notesAppRemote: { ...bo.notesAppRemote, settings: {} },
  })?.fileName === "f_first.jpg"
);
check(
  "stale mainPhotoNoteId → first free photo",
  pickBusinessObjectMainPhotoNote({
    ...bo,
    notesAppRemote: {
      ...bo.notesAppRemote,
      settings: { mainPhotoNoteId: "nope" },
    },
  })?.fileName === "f_first.jpg"
);
check(
  "photo without fileName skipped",
  pickBusinessObjectMainPhotoNote({
    notesAppNotes: [{ idMaster: "x", type: "photo" }],
  }) === null
);
check("no notes → null", pickBusinessObjectMainPhotoNote(local) === null);

console.log(failures ? `\n${failures} failure(s)` : "\nall ok");
process.exit(failures ? 1 : 0);
