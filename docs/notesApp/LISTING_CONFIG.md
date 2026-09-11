# Krnet listing configuration in Bimboxa

Sync orchestrator, plans, positions and shapes: see [SYNC.md](SYNC.md).

Krnet (notes-app, mobile) configures each list through `listings.settings`
(JSON) + `state_models` / `listing_state_models` rows. Bimboxa mirrors that
configuration on its business-object listings so a list configured in either
app carries EXACTLY the same model, and syncs it both ways through the
notes-app integration (`src/Features/notesApp/`).

UI entry point: the "Avancé" tab of the business-object listing properties
panel (`PanelBusinessObjectListingProperties`, tabs "Général" / "Avancé",
tab key in `businessObjectsSlice.listingPropertiesTab`, kept across
listings and business-object modules), visible when `appConfig.features.notesApp.enabled === true`. The
tab renders the root CONFIG view inline (`SectionNotesAppListingAdvanced` →
`ViewListingConfigMain isRoot`: link status line + "Envoyer vers Krnet"
button, identity, naming, organisation, map label / object preview,
exclusions). Sub-views (view stack in `notesAppSlice.listingConfigView`,
router `PanelNotesAppListingConfig`, they replace the whole panel until the
stack empties): FIELDS / FIELD, STATE_MODELS / STATE_MODEL / STATE,
AUTO_CODE. Contents and strings follow the mobile screens
(`ConfigEntityModelScreen`, `FieldEditorScreen`, `ConfigStateModelScreen`,
`ConfigStateScreen`, `ConfigAutoCodeScreen`). The wording never says
"Krnet" for the configuration itself: it is the Bimboxa listing
configuration, which happens to sync.

## Storage (`db.listings` row, schemaless)

```js
listing.idMaster      // Krnet listing id (set at pull or first push)
listing.remoteSource  // "notesApp"
listing.notesApp = {
  settings,           // Krnet listing.settings, PARSED, same keys / semantics
  stateModels: [{     // state_models + their listing_state_models row
    id, name, states: [{id,name,color}], transitions: [{fromState,toState[]}],
    settings: { freeTransitions?, initialStateId?, isPrimary? },
    visible, navName, listingStateModelId, updatedAt, deletedAt?, isLocalOnly?
  }],
  entityModelId,      // Krnet entity_models id (1:1 with the list)
  icon, color,        // Krnet tokens, round-trip only
  remoteUpdatedAt,    // ms — remote signature seen at last pull/push (cursor)
  localUpdatedAt,     // ISO — last config / name edit in Bimboxa, null = clean
}
```

Semantics (Krnet parity, `utils/notesAppListingSettings.js`): boolean keys
deleted when false, `itemName` deleted when blank, `incrementalFirstName`
deleted when naming is off, `mapLabel` deleted when `'name'`, `mapCard` stores
only the non-default slot keys (`avatar` / `primary` / `secondary`) and
PRESERVES the Krnet-only keys (`avatarFallbackListingIds`,
`avatarFallbackTemplateKeys`); text sources are `name`, `code`, a field id
or `<fieldId>:code` for link fields; `listCard` (rows use the preview)
deleted when false, `classifications` is DERIVED from the `category`
fields (`syncDerivedFromFields`), `autoCode` kept with `enabled:false`, legacy
`type:'name'` field stripped on read. State models: `initialStateId` absent →
first state, `null` → none; `freeTransitions` absent → true; `isPrimary`
exclusive (`utils/notesAppStateModels.js`).

Listing references inside `settings` (`nomenclatureListingId`,
`targetListingId`, `sourceListingIds`, `classifications[]`,
`autoCode.nomenclatureListingId`) hold LOCAL Bimboxa listing ids; they are
remapped both ways by `utils/remapNotesAppListingRefs.js` (unknown ids pass
through: dangling ref → "— supprimée —", ref to an ignored Krnet list →
"— liste non synchronisée —", kept intact on push). State model / state ids
are shared verbatim.

Every write goes through `hooks/useUpdateListingNotesAppConfig.js`
(ownership guard, fresh read, `localUpdatedAt` stamp). Renaming the listing
also stamps `localUpdatedAt`.

## Pull (`services/mergeNotesAppListingConfig.js` → `utils/buildNotesAppListingConfigPatch.js`)

Runs per mapped pair inside `syncNotesAppScope`. Remote signature = max
`updatedAt` of the listing, entity model, state models and lsm rows
(tombstones included). Decision:

| local                                             | rule               | result                      |
| ------------------------------------------------- | ------------------ | --------------------------- |
| no `notesApp` block                               | first link         | apply, local name kept      |
| signature ≤ `remoteUpdatedAt`                     | nothing new        | unchanged                   |
| clean (`localUpdatedAt` null / older than cursor) |                    | apply (name follows remote) |
| dirty, remote newer than the local edit           | last-modified-wins | apply                       |
| dirty and newer                                   |                    | keep local (pushed later)   |

`listing.updatedAt` is deliberately NOT used (bumped by every listing write).
The patch never sets `updatedAt`. Local-only state models (never pushed)
survive a pull.

## Push (`services/pushNotesAppListingsConfig.js` → `utils/buildNotesAppListingConfigPushRows.js`)

Explicit user action (Sync panel button, or "Envoyer vers Krnet" in the CONFIG
view with `force` for that listing). Ids are assigned for every listing of
the scope (`idMaster` > mapping entry > new nanoid), but only unlinked or
dirty listings are sent, plus the closure of unlinked listings they
reference. Rows are upserted in order `entity_models → listings →
state_models → listing_state_models` (snake_case, JSON columns stringified,
unix seconds, `created_by` only on new rows, tombstoned state models carry
`deleted_at`). Bookkeeping under `withSystemWrite(withoutUndo(...))`:
`idMaster`, `remoteSource`, `entityModelId`, lsm ids, cursors, plus a
`mapped` entry in `scope.notesApp.listingsMapping` for newly linked listings
(otherwise the next pull would create a duplicate list).

## List-card rows in Bimboxa (`settings.listCard`)

When `listCard` is on, the object rows of the left panel
(`BusinessObjectTreeItem`, title rows excluded) render the "Aperçu de
l'objet": a 28px avatar + primary + secondary texts, in place of the color
square + label (the number column, located icon, quantity, chip and actions
stay). Resolution = `businessObjects/utils/resolveBusinessObjectCard.js`
(pure port of the mobile `resolveEntityCard`), context built once per tree
by `businessObjects/hooks/useBusinessObjectsListCard.js`:

| source         | read from                                                                                |
| -------------- | ---------------------------------------------------------------------------------------- |
| `name`         | `businessObject.label`                                                                   |
| `code`         | `businessObject.code` (Krnet-pulled objects only)                                        |
| field          | effective value of the field (see "Fiche" below) → its display text                      |
| avatar `photo` | main photo note (`notesAppRemote.settings.mainPhotoNoteId`, else first free photo note)  |
|                | → `db.files` → thumbnail (`notesApp/services/getNotesAppPhotoThumbnailUrl.js`, in-memory |
|                | cache); no photo → initial of the primary text on the object / listing color             |

Empty primary → name; empty secondary stays empty in a row. Stale sources
(deleted field, `:code` on a non-link field) fall back to the defaults
(`getEffectiveCardSource`).

## "Fiche" tab — field values on the objects

`PanelBusinessObjectProperties` gets a "Fiche" tab (tab key
`notesAppSlice.objectPropertiesTab`, shown when the listing model has
fields) — `SectionBusinessObjectFiche`: one input per field of the model
(freeText text, state select over the field's state model, category select
over the nomenclature listing objects, linkSingle / linkMulti selects over
the target listing objects; photo and location read-only; linkIndirect
hidden). Pure model `businessObjects/utils/businessObjectFieldValues.js`,
context hook `useBusinessObjectFieldsContext` (objects of the referenced
listings indexed by local id and Krnet id):

| layer                 | where                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| local edits (Bimboxa) | `businessObject.fieldValues[fieldId]` — freeText string, state id,        |
|                       | category / linkSingle LOCAL object id, linkMulti LOCAL ids                |
| Krnet snapshot (pull) | `notesAppRemote.fields[fieldId]` (freeText), `stateValues[stateModelId]`, |
|                       | `settings.categories[<nomenclature idMaster>]` = remote object id mapped  |
|                       | to the local object through its `idMaster`; links are not pulled          |

Effective value = local when the key exists, else remote. Empty local
value → key removed (the snapshot shows through). Pull rule: a newer remote
row drops `fieldValues` (row-level last-modified-wins: local edits bump
`updatedAt` and protect the row until Krnet changes it). Pushing the values
to Krnet is future work.
Replay: `scripts/replay/businessObjectCardReplay.js`.

## Traps

- `duplicateScopeService`: the copy keeps the config but drops the link
  (`idMaster`, `entityModelId`, `scope.notesApp`), remaps listing refs and
  regenerates state model ids (`state_models.id` is a global Supabase key).
- `treeMode` (Krnet setting) is independent from Bimboxa `isTree`.
- Krnet stores the list name on BOTH `entity_models` and `listings`.
- Krto zips carry the listing rows whole (`notesApp`, `idMaster` included):
  an import into another project keeps stale link fields (future work).

Node replays of the pure utils: `scripts/replay/notesAppListingConfigReplay.js`,
`scripts/replay/businessObjectCardReplay.js`.
