// Node replay of the Krnet listing-configuration pure utils: settings
// setters (delete-when-default), derived classifications, field building /
// validation, state models rules, auto code, listing-ref remap round-trip,
// and the two pure cores of the sync (pull patch, push rows).
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/notesAppListingConfigReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/notesAppListingConfigReplay.mjs && node /tmp/notesAppListingConfigReplay.mjs
//
// Exits 1 on any failure.
/* global process */

import {
  syncDerivedFromFields,
  setBooleanSetting,
  setItemName,
  setIncrementalNaming,
  setMapLabel,
  setMapCard,
  stripLegacyNameField,
  buildField,
  isFieldValid,
  getFieldSummary,
  collectNotesAppListingRefs,
} from "Features/notesApp/utils/notesAppListingSettings";
import {
  buildDefaultStateModel,
  buildNewState,
  removeState,
  getInitialStateId,
  setPrimary,
  getPrimaryStateModel,
  hasFreeTransitions,
} from "Features/notesApp/utils/notesAppStateModels";
import {
  getNextIncrementalName,
  computeAutoCode,
} from "Features/notesApp/utils/notesAppAutoCode";
import remapNotesAppListingRefs, {
  remapNotesAppStateModelIds,
} from "Features/notesApp/utils/remapNotesAppListingRefs";
import buildNotesAppListingConfigPatch from "Features/notesApp/utils/buildNotesAppListingConfigPatch";
import buildNotesAppListingConfigPushRows from "Features/notesApp/utils/buildNotesAppListingConfigPushRows";

let failures = 0;

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- settings setters

console.log("settings setters");
check(
  "boolean true stored",
  setBooleanSetting({}, "treeMode", true).treeMode === true
);
check(
  "boolean false deletes key",
  !("treeMode" in setBooleanSetting({ treeMode: true }, "treeMode", false))
);
check(
  "itemName blank deletes",
  !("itemName" in setItemName({ itemName: "Site" }, "  "))
);
check(
  "incremental off drops first name",
  !(
    "incrementalFirstName" in
    setIncrementalNaming(
      { incrementalNaming: true, incrementalFirstName: "S-001" },
      false
    )
  )
);
check(
  "mapLabel name deletes",
  !("mapLabel" in setMapLabel({ mapLabel: "code" }, "name"))
);
check("mapLabel code stored", setMapLabel({}, "code").mapLabel === "code");
const mc = setMapCard({}, "avatar", "none");
check("mapCard stores non-default only", eq(mc.mapCard, { avatar: "none" }));
check(
  "mapCard all default deletes",
  !("mapCard" in setMapCard(mc, "avatar", "photo"))
);

// --- derived classifications + legacy name

console.log("fields");
const fields = [
  { id: "f1", type: "photo", label: "Photo", required: false },
  {
    id: "f2",
    type: "category",
    label: "Type",
    required: true,
    nomenclatureListingId: "L2",
  },
];
const derived = syncDerivedFromFields(
  { foo: 1, classifications: [{ nomenclatureListingId: "old" }] },
  fields
);
check(
  "classifications derived",
  eq(derived.classifications, [
    { nomenclatureListingId: "L2", label: "Type", required: true },
  ])
);
check("other keys kept", derived.foo === 1);
check(
  "classifications deleted when no category",
  !(
    "classifications" in
    syncDerivedFromFields({ classifications: [] }, [fields[0]])
  )
);
const stripped = stripLegacyNameField({
  fields: [{ id: "n", type: "name" }, fields[0]],
});
check(
  "legacy name stripped",
  stripped.fields.length === 1 && stripped.fields[0].id === "f1"
);
const li = buildField({
  type: "linkIndirect",
  label: " X ",
  required: true,
  targetListingId: "L3",
  sourceListingIds: ["L4"],
});
check(
  "linkIndirect has no required",
  !("required" in li) && eq(li.sourceListingIds, ["L4"]) && li.label === "X"
);
const ls = buildField({
  id: "fx",
  type: "linkSingle",
  label: "Lien",
  targetListingId: "L3",
});
check(
  "linkSingle keeps id + readOnly false",
  ls.id === "fx" && ls.readOnly === false && ls.required === false
);
check(
  "valid: freeText with label",
  isFieldValid({ type: "freeText", label: "T" })
);
check("invalid: empty label", !isFieldValid({ type: "freeText", label: " " }));
check(
  "invalid: category without nomenclature",
  !isFieldValid({ type: "category", label: "C" })
);
check(
  "invalid: state without model",
  !isFieldValid({ type: "state", label: "S" })
);
check(
  "invalid: linkIndirect without target",
  !isFieldValid({ type: "linkIndirect", label: "S" })
);
const ctx = {
  listingById: { L2: { name: "Nomenc" } },
  stateModelById: {},
  ignoredRemoteIds: new Set(["R9"]),
};
check(
  "summary category",
  getFieldSummary(fields[1], ctx) === "Catégorie · Nomenc · obligatoire"
);
check(
  "summary dangling",
  getFieldSummary({ type: "linkSingle", targetListingId: "zz" }, ctx) ===
    "— supprimée — · lien unique"
);
check(
  "summary ignored remote",
  getFieldSummary({ type: "linkMulti", targetListingId: "R9" }, ctx).startsWith(
    "— liste non synchronisée —"
  )
);
check(
  "collect refs",
  eq(
    collectNotesAppListingRefs({
      fields: [fields[1], li],
      autoCode: { nomenclatureListingId: "L5" },
    }).sort(),
    ["L2", "L3", "L4", "L5"]
  )
);

// --- state models

console.log("state models");
const dsm = buildDefaultStateModel({ id: "sm1" });
check(
  "default model shape",
  dsm.name === "Nouveau suivi" &&
    dsm.states.length === 3 &&
    dsm.settings.initialStateId === "new1" &&
    dsm.isLocalOnly === true &&
    dsm.visible === true
);
check(
  "new state color rotation",
  buildNewState(dsm.states).color === "orange" &&
    buildNewState([]).color === "red"
);
const withTransitions = {
  ...dsm,
  transitions: [
    { fromState: "new1", toState: ["new2", "new3"] },
    { fromState: "new2", toState: ["new3"] },
  ],
};
const removed = removeState(withTransitions, "new2");
check(
  "removeState prunes from + to",
  removed.states.length === 2 &&
    eq(removed.transitions, [{ fromState: "new1", toState: ["new3"] }])
);
check(
  "removeState keeps initial when other",
  removed.settings.initialStateId === "new1"
);
check(
  "removeState clears initial when pointed",
  removeState(withTransitions, "new1").settings.initialStateId === null
);
check(
  "initial absent -> first",
  getInitialStateId({ states: [{ id: "a" }], settings: {} }) === "a"
);
check(
  "initial null -> none",
  getInitialStateId({
    states: [{ id: "a" }],
    settings: { initialStateId: null },
  }) === null
);
check(
  "freeTransitions absent -> true",
  hasFreeTransitions({ settings: {} }) &&
    !hasFreeTransitions({ settings: { freeTransitions: false } })
);
const sms = [
  { id: "a", settings: { isPrimary: true } },
  { id: "b", settings: {} },
];
const prim = setPrimary(sms, "b", true);
check(
  "primary exclusive",
  prim[0].settings.isPrimary === false && prim[1].settings.isPrimary === true
);
check(
  "primary fallback first",
  getPrimaryStateModel([{ id: "x", settings: {} }, { id: "y" }]).id === "x"
);

// --- auto code

console.log("auto code");
check(
  "no peers -> firstFull",
  computeAutoCode({
    autoCode: { enabled: true, firstSuffix: "-001" },
    categoryEntity: { code: "A" },
    listingPeers: [],
  }) === "A-001"
);
check(
  "increment highest",
  computeAutoCode({
    autoCode: { enabled: true, firstSuffix: "-001" },
    categoryEntity: { code: "A" },
    listingPeers: [{ code: "A-001" }, { code: "A-003" }, { code: "B-009" }],
  }) === "A-004"
);
check(
  "padding preserved",
  getNextIncrementalName(["P-0007"], "P-001") === "P-0008"
);
check(
  "no digits fallback",
  getNextIncrementalName(["P-x", "P-y"], "P-001") === "P-003"
);
check(
  "category without code -> null",
  computeAutoCode({
    autoCode: { enabled: true, firstSuffix: "-001" },
    categoryEntity: { code: "" },
    listingPeers: [],
  }) === null
);
check(
  "disabled -> null",
  computeAutoCode({
    autoCode: { enabled: false },
    categoryEntity: { code: "A" },
    listingPeers: [],
  }) === null
);

// --- remap

console.log("remap");
const settingsFixture = {
  fields: [
    { id: "f1", type: "category", nomenclatureListingId: "loc2" },
    { id: "f2", type: "linkMulti", targetListingId: "loc3" },
    {
      id: "f3",
      type: "linkIndirect",
      targetListingId: "loc3",
      sourceListingIds: ["loc2", "unknown"],
    },
    { id: "f4", type: "state", stateModelId: "sm1" },
  ],
  classifications: [
    { nomenclatureListingId: "loc2", label: "x", required: false },
  ],
  autoCode: { enabled: true, nomenclatureListingId: "loc2" },
  treeMode: true,
};
const frozen = JSON.stringify(settingsFixture);
const toRemote = new Map([
  ["loc2", "rem2"],
  ["loc3", "rem3"],
]);
const toLocal = new Map([
  ["rem2", "loc2"],
  ["rem3", "loc3"],
]);
const remote = remapNotesAppListingRefs(settingsFixture, toRemote);
check(
  "remap forward",
  remote.fields[0].nomenclatureListingId === "rem2" &&
    remote.fields[2].targetListingId === "rem3" &&
    remote.autoCode.nomenclatureListingId === "rem2" &&
    remote.classifications[0].nomenclatureListingId === "rem2"
);
check(
  "unknown passthrough",
  remote.fields[2].sourceListingIds[1] === "unknown"
);
check(
  "round trip identity",
  eq(remapNotesAppListingRefs(remote, toLocal), settingsFixture)
);
check("input not mutated", JSON.stringify(settingsFixture) === frozen);
const smRemap = remapNotesAppStateModelIds(
  { settings: settingsFixture, stateModels: [{ id: "sm1" }] },
  { sm1: "sm9" }
);
check(
  "state model ids remapped",
  smRemap.stateModels[0].id === "sm9" &&
    smRemap.settings.fields[3].stateModelId === "sm9"
);

// --- pull patch

console.log("pull patch");
const remoteListing = {
  id: "rem1",
  entityModelId: "em1",
  name: "Remote",
  icon: "box",
  color: "#123456",
  updatedAt: 2000,
  settings: {
    fields: [
      { id: "n", type: "name" },
      { id: "f1", type: "category", nomenclatureListingId: "rem2" },
    ],
  },
};
const remoteSms = [
  {
    id: "sm1",
    entityModelId: "em1",
    name: "Statut",
    states: [{ id: "s1", name: "A", color: "red" }],
    transitions: [],
    settings: { freeTransitions: true },
    updatedAt: 1500,
  },
  {
    id: "sm2",
    entityModelId: "em1",
    name: "Old",
    states: [],
    transitions: [],
    settings: {},
    updatedAt: 3000,
    deletedAt: 3000,
  },
];
const remoteLsms = [
  {
    id: "lsm1",
    listingId: "rem1",
    stateModelId: "sm1",
    name: "Nav",
    visible: 0,
    updatedAt: 1600,
  },
];
const base = {
  remoteListing,
  remoteEntityModel: { id: "em1", updatedAt: 1000 },
  remoteStateModels: remoteSms,
  remoteListingStateModels: remoteLsms,
  remoteToLocalListingId: toLocal,
};

const r1 = buildNotesAppListingConfigPatch({
  ...base,
  listing: { id: "loc1", name: "Local" },
});
check(
  "never linked -> apply, name kept",
  r1.decision === "apply" &&
    !("name" in r1.patch) &&
    r1.patch.idMaster === "rem1"
);
check(
  "signature = max incl tombstone",
  r1.signature === 3000 && r1.patch.notesApp.remoteUpdatedAt === 3000
);
check(
  "legacy name stripped + refs remapped",
  r1.patch.notesApp.settings.fields.length === 1 &&
    r1.patch.notesApp.settings.fields[0].nomenclatureListingId === "loc2"
);
check(
  "tombstoned sm carries deletedAt ISO",
  r1.patch.notesApp.stateModels[1].deletedAt === new Date(3000).toISOString()
);
check(
  "lsm visible 0 -> false, navName, lsm id",
  r1.patch.notesApp.stateModels[0].visible === false &&
    r1.patch.notesApp.stateModels[0].navName === "Nav" &&
    r1.patch.notesApp.stateModels[0].listingStateModelId === "lsm1"
);
check(
  "icon/color/entityModelId",
  r1.patch.notesApp.icon === "box" && r1.patch.notesApp.entityModelId === "em1"
);

const r2 = buildNotesAppListingConfigPatch({
  ...base,
  listing: { id: "loc1", notesApp: { remoteUpdatedAt: 3000 } },
});
check(
  "signature <= cursor -> unchanged",
  r2.decision === "unchanged" && r2.patch === null
);

const localOnlySm = { id: "smL", name: "Local", isLocalOnly: true, states: [] };
const r3 = buildNotesAppListingConfigPatch({
  ...base,
  listing: {
    id: "loc1",
    name: "Local",
    notesApp: {
      remoteUpdatedAt: 1000,
      localUpdatedAt: null,
      stateModels: [localOnlySm],
    },
  },
});
check(
  "clean local -> apply, name overwritten",
  r3.decision === "apply" && r3.patch.name === "Remote"
);
check(
  "local-only sm preserved",
  r3.patch.notesApp.stateModels.some((s) => s.id === "smL")
);
check("localUpdatedAt reset", r3.patch.notesApp.localUpdatedAt === null);

const r4 = buildNotesAppListingConfigPatch({
  ...base,
  listing: {
    id: "loc1",
    notesApp: {
      remoteUpdatedAt: 1000,
      localUpdatedAt: new Date(5000).toISOString(),
    },
  },
});
check(
  "dirty local newer -> keepLocal",
  r4.decision === "keepLocal" && r4.patch === null
);
const r5 = buildNotesAppListingConfigPatch({
  ...base,
  listing: {
    id: "loc1",
    notesApp: {
      remoteUpdatedAt: 1000,
      localUpdatedAt: new Date(2500).toISOString(),
    },
  },
});
check(
  "dirty local older -> remoteWon",
  r5.decision === "remoteWon" && r5.patch !== null
);

// --- push rows

console.log("push rows");
const nowIso = new Date(10_000_000).toISOString();
const listings = [
  {
    id: "loc1",
    name: "A",
    idMaster: "rem1",
    notesApp: {
      entityModelId: "em1",
      settings: {
        fields: [{ id: "f1", type: "category", nomenclatureListingId: "loc2" }],
      },
      stateModels: [
        {
          id: "sm1",
          name: "S",
          states: [],
          transitions: [],
          settings: {},
          visible: false,
          navName: "Nav",
          listingStateModelId: "lsm1",
        },
        {
          id: "smD",
          name: "D",
          states: [],
          transitions: [],
          settings: {},
          deletedAt: nowIso,
          listingStateModelId: "lsmD",
        },
        { id: "smX", isLocalOnly: true, deletedAt: nowIso },
      ],
      remoteUpdatedAt: 1000,
      localUpdatedAt: new Date(2000).toISOString(),
    },
  },
  {
    id: "loc2",
    name: "B",
    notesApp: {
      settings: { treeMode: true },
      stateModels: [
        {
          id: "smN",
          name: "N",
          states: [],
          transitions: [],
          settings: {},
          isLocalOnly: true,
        },
      ],
    },
  },
  {
    id: "loc3",
    name: "C",
    idMaster: "rem3",
    notesApp: {
      entityModelId: "em3",
      settings: {},
      remoteUpdatedAt: 5000,
      localUpdatedAt: null,
    },
  },
  { id: "loc4", name: "D" },
];
const scopeLink = {
  listingsMapping: [
    { remoteListingId: "rem4", localListingId: "loc4", mode: "mapped" },
  ],
};
const p = buildNotesAppListingConfigPushRows({
  listings,
  scopeLink,
  notesAppProjectId: "proj",
  sessionUserId: "user",
  nowSec: 123,
});
const pushedIds = p.assignments.map((a) => a.listingId).sort();
check(
  "selection: dirty + unlinked (+closure), clean excluded",
  eq(pushedIds, ["loc1", "loc2", "loc4"])
);
check(
  "id priority: idMaster > mapping > nanoid",
  p.localToRemote.get("loc1") === "rem1" &&
    p.localToRemote.get("loc4") === "rem4" &&
    typeof p.localToRemote.get("loc2") === "string" &&
    p.localToRemote.get("loc2").length > 10
);
const lrow = p.rows.listings.find((r) => r.id === "rem1");
check(
  "listing row snake_case + settings string remapped",
  typeof lrow.settings === "string" &&
    JSON.parse(lrow.settings).fields[0].nomenclatureListingId ===
      p.localToRemote.get("loc2") &&
    lrow.entity_model_id === "em1" &&
    lrow.updated_at === 123
);
check("no created_by on existing listing", !("created_by" in lrow));
check(
  "created_by on new listing",
  p.rows.listings.find((r) => r.id === p.localToRemote.get("loc2"))
    .created_by === "user"
);
check(
  "entity model rows",
  p.rows.entityModels.length === 3 &&
    p.rows.entityModels.find((r) => r.id === "em1").name === "A" &&
    !("created_by" in p.rows.entityModels.find((r) => r.id === "em1"))
);
const smRows = p.rows.stateModels;
check(
  "state model rows: tombstone kept, local-only deleted skipped",
  smRows.some((r) => r.id === "smD" && r.deleted_at === 10_000) &&
    !smRows.some((r) => r.id === "smX")
);
check(
  "json columns are strings",
  typeof smRows[0].states === "string" && typeof smRows[0].settings === "string"
);
check(
  "lsm visible 0/1 + ids",
  p.rows.listingStateModels.find((r) => r.state_model_id === "sm1").visible ===
    0 &&
    p.rows.listingStateModels.find((r) => r.state_model_id === "sm1").id ===
      "lsm1"
);
const newLsm = p.rows.listingStateModels.find(
  (r) => r.state_model_id === "smN"
);
check(
  "new lsm gets id + created_by",
  newLsm &&
    newLsm.id.length > 10 &&
    newLsm.created_by === "user" &&
    newLsm.name === "N" &&
    newLsm.visible === 1
);
check(
  "no templateId anywhere",
  !p.rows.listings.some((r) => "template_id" in r || "templateId" in r)
);
check(
  "mapping entries for unmapped pushed listings",
  eq(p.mappingEntries.map((m) => m.localListingId).sort(), ["loc1", "loc2"])
);
const forced = buildNotesAppListingConfigPushRows({
  listings,
  scopeLink,
  notesAppProjectId: "proj",
  sessionUserId: "user",
  nowSec: 1,
  listingIds: ["loc3"],
  force: true,
});
check(
  "force pushes a clean listing only",
  eq(
    forced.assignments.map((a) => a.listingId),
    ["loc3"]
  )
);
const subset = buildNotesAppListingConfigPushRows({
  listings,
  scopeLink,
  notesAppProjectId: "proj",
  sessionUserId: "user",
  nowSec: 1,
  listingIds: ["loc3"],
});
check(
  "clean subset without force pushes nothing",
  subset.assignments.length === 0
);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall ok");
