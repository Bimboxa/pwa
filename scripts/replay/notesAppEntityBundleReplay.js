// Node replay of the per-object pull pure parts: related-object ids and the
// mini dumps (buildNotesAppEntityDumps), the Krnet links carried by the
// entity mapping (mapNotesAppEntityToBusinessObject), their resolution in
// the link fields (businessObjectFieldValues) and the debug payload of the
// object header.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/notesAppEntityBundleReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/notesAppEntityBundleReplay.mjs && node /tmp/notesAppEntityBundleReplay.mjs
//
// Exits 1 on any failure.
/* global process */

import {
  buildNotesAppEntityDumps,
  getRelatedEntityIds,
} from "Features/notesApp/utils/buildNotesAppEntityDumps";
import mapNotesAppEntityToBusinessObject from "Features/notesApp/utils/mapNotesAppEntityToBusinessObject";
import { getBusinessObjectFieldValue } from "Features/businessObjects/utils/businessObjectFieldValues";
import buildBusinessObjectDebugPayload from "Features/businessObjects/utils/buildBusinessObjectDebugPayload";

let failures = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- related ids

console.log("related entity ids");
const entity = {
  id: "e1",
  listingId: "L1",
  name: "P-1",
  settings: { categories: { LCAT: "cat1", LOTHER: "" } },
};
const links = [
  { id: "lk1", sourceEntityId: "e1", targetEntityId: "t1", sortKey: "a1" },
  { id: "lk2", sourceEntityId: "e1", targetEntityId: "t2", deletedAt: 5 },
  { id: "lk3", sourceEntityId: "zz", targetEntityId: "t3" },
];
const rels = [
  { id: "r1", annotationId: "s1", entityId: "e1" },
  { id: "r2", annotationId: "s1", entityId: "co1" },
  { id: "r3", annotationId: "s1", entityId: "co2", deletedAt: 9 },
];
const relatedIds = getRelatedEntityIds({
  entity,
  links,
  relsEntityAnnotation: rels,
});
check(
  "live link targets + categories + co-linked objects, self excluded",
  eq([...relatedIds].sort(), ["cat1", "co1", "t1"]),
  JSON.stringify(relatedIds)
);
check(
  "no settings → no crash",
  eq(
    getRelatedEntityIds({
      entity: { id: "x" },
      links: [],
      relsEntityAnnotation: [],
    }),
    []
  )
);

// --- mini dumps

console.log("mini dumps");
const related = [
  { id: "t1", listingId: "L2" },
  { id: "co1", listingId: "L1" },
  { id: "e1", listingId: "L1" }, // duplicate of the entity: dropped
];
const dumps = buildNotesAppEntityDumps({
  entity,
  relatedEntities: related,
  notes: [{ id: "n1", entityId: "e1" }],
  links,
  annotations: [
    { id: "s1", type: "POLYGON" },
    { id: "s1", type: "POLYGON" },
    { id: "m1", type: "MARKER", entityId: "e1" },
  ],
  relsEntityAnnotation: [...rels, rels[0]],
});
check(
  "objects dump: entity + related, deduped",
  eq(
    dumps.objectsDump.entities.map((e) => e.id),
    ["e1", "t1", "co1"]
  )
);
check(
  "objects dump carries notes + links",
  dumps.objectsDump.notes.length === 1 && dumps.objectsDump.links.length === 3
);
check(
  "shapes dump: same entities, annotations + rels deduped",
  eq(
    dumps.shapesDump.entities.map((e) => e.id),
    ["e1", "t1", "co1"]
  ) &&
    dumps.shapesDump.annotations.length === 2 &&
    dumps.shapesDump.relsEntityAnnotation.length === 3
);

// --- links on the mapped row

console.log("entity mapping links");
const remoteLinks = [
  { id: "lk1", targetEntityId: "t1", sortKey: "a1", updatedAt: 1000 },
  { id: "lk4", targetEntityId: "t4", sortKey: "a2", updatedAt: 2000 },
];
const mapped = mapNotesAppEntityToBusinessObject({
  remoteEntity: { id: "e1", name: "P-1", listingId: "L1", updatedAt: 1000 },
  remoteListing: { id: "L1", settings: { fields: [] } },
  localId: "local1",
  bimboxaListing: { id: "bl1" },
  projectId: "p",
  userIdMaster: "u",
  remoteLinks,
});
check(
  "notesAppRemote.links copied",
  eq(mapped.notesAppRemote.links, remoteLinks)
);
check(
  "links default to []",
  eq(
    mapNotesAppEntityToBusinessObject({
      remoteEntity: { id: "e2", name: "x" },
      remoteListing: null,
      localId: "l2",
      bimboxaListing: { id: "bl1" },
      projectId: "p",
      userIdMaster: "u",
    }).notesAppRemote.links,
    []
  )
);

// --- link fields resolution

console.log("link fields");
const ctx = {
  categoryLocalIdByIdMaster: { t1: "lt1", t4: "lt4" },
  objectById: {
    lt1: { id: "lt1", listingId: "target" },
    lt4: { id: "lt4", listingId: "elsewhere" },
  },
};
const single = { id: "f1", type: "linkSingle", targetListingId: "target" };
const multi = { id: "f2", type: "linkMulti", targetListingId: "target" };
check(
  "linkSingle → first link of the target listing, local id",
  getBusinessObjectFieldValue(mapped, single, ctx) === "lt1"
);
check(
  "linkMulti → links of the target listing only",
  eq(getBusinessObjectFieldValue(mapped, multi, ctx), ["lt1"])
);
check(
  "unknown target locally → dropped",
  eq(
    getBusinessObjectFieldValue(
      mapped,
      { ...multi, targetListingId: "elsewhere" },
      { ...ctx, categoryLocalIdByIdMaster: {} }
    ),
    []
  )
);
check(
  "local edit wins over the remote links",
  getBusinessObjectFieldValue(
    { ...mapped, fieldValues: { f1: "manual" } },
    single,
    ctx
  ) === "manual"
);
check(
  "no target listing → empty",
  eq(
    getBusinessObjectFieldValue(mapped, { id: "f3", type: "linkMulti" }, ctx),
    []
  )
);

// --- debug payload

console.log("debug payload");
const payload = buildBusinessObjectDebugPayload({
  businessObject: mapped,
  listing: { id: "bl1", name: "Ouvrages", idMaster: "L1", notesApp: { x: 1 } },
  scopeLink: {
    projectId: "proj",
    listingsMapping: [
      { remoteListingId: "L1", localListingId: "bl1", mode: "mapped" },
    ],
  },
  rels: [{ id: "rel1" }],
  annotations: [{ id: "a1", type: "LABEL", baseMapId: "bm", label: "P-1" }],
});
check("payload keeps the row whole", payload.businessObject === mapped);
check(
  "payload resolves the listing mapping entry",
  payload.scopeNotesApp.listingsMappingEntry.remoteListingId === "L1"
);
check(
  "payload summarizes annotations",
  eq(Object.keys(payload.linkedAnnotations[0]).slice(0, 3), [
    "id",
    "idMaster",
    "type",
  ])
);
check("payload serializes", typeof JSON.stringify(payload) === "string");

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall ok");
