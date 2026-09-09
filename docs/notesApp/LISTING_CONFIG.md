# Krnet listing configuration in Bimboxa

Krnet (notes-app, mobile) configures each list through `listings.settings`
(JSON) + `state_models` / `listing_state_models` rows. Bimboxa mirrors that
configuration on its business-object listings so a list configured in either
app carries EXACTLY the same model, and syncs it both ways through the
notes-app integration (`src/Features/notesApp/`).

UI entry point: "Configuration Krnet" card in the business-object listing
properties panel (`PanelBusinessObjectListingProperties`), visible when
`appConfig.features.notesApp.enabled === true`. Sub-views (view stack in
`notesAppSlice.listingConfigView`): CONFIG (identity, naming, organisation,
map label / card, exclusions) → FIELDS / FIELD, STATE_MODELS / STATE_MODEL /
STATE, AUTO_CODE. Contents and strings follow the mobile screens
(`ConfigEntityModelScreen`, `FieldEditorScreen`, `ConfigStateModelScreen`,
`ConfigStateScreen`, `ConfigAutoCodeScreen`).

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
only non-default keys, `classifications` is DERIVED from the `category`
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

## Traps

- `duplicateScopeService`: the copy keeps the config but drops the link
  (`idMaster`, `entityModelId`, `scope.notesApp`), remaps listing refs and
  regenerates state model ids (`state_models.id` is a global Supabase key).
- `treeMode` (Krnet setting) is independent from Bimboxa `isTree`.
- Krnet stores the list name on BOTH `entity_models` and `listings`.
- Krto zips carry the listing rows whole (`notesApp`, `idMaster` included):
  an import into another project keeps stale link fields (future work).

Node replay of the pure utils: `scripts/replay/notesAppListingConfigReplay.js`.
