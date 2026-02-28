# Listings

## What is a listing?

A **listing** is a container (list) of entities. It defines *what type* of entities it holds, *how* they are displayed, and *what fields* they have. Every entity belongs to exactly one listing.

A listing carries its **entityModel** — a data model from the app configuration that defines the entity type (e.g. `LOCATED_ENTITY`, `ZONE_ENTITY`, `BASE_MAP`, `BLUEPRINT`, `ANNOTATION_TEMPLATE`), the entity fields, labels, computed fields, etc.

## Listing properties

| Property | Description |
|---|---|
| `id` | Unique identifier (nanoid) |
| `key` | Preset key (from appConfig presetListingsObject), optional |
| `name` | Display name |
| `projectId` | Parent project |
| `scopeId` | Parent scope (set for LOCATED_ENTITY, BLUEPRINT types) |
| `entityModelKey` | Key referencing the entity model in appConfig |
| `entityModel` | Resolved entity model object (stored at creation) |
| `table` | Dexie table where entities are stored (e.g. `"entities"`, `"baseMaps"`) |
| `canCreateItem` | Whether the user can create entities in this listing |
| `metadata` | Arbitrary metadata (may contain file references) |
| `annotationTemplatesLibrary` | Annotation templates to create alongside the listing |
| `initialEntities` | Entities to create when the listing is created |
| `relatedListings` | Map of field keys to related listing objects |
| `relatedEntities` | Related entities configuration |
| `iconKey` | Icon identifier |
| `color` | Display color |
| `spriteImageKey` | Sprite image key for annotations |
| `uniqueByProject` | If true, only one listing with this key per project |
| `createdBy` | User email of the creator |

## Dexie schema

```
listings: "id, key, uniqueByProject, projectId, scopeId"
```

Listings are part of the audit tables (`createdAt`, `updatedAt` auto-populated) and soft-delete tables (`deletedAt` field).

## Creation flow

All listings are created through a single hook: **`useCreateListings`** (`Features/listings/hooks/useCreateListings.js`).

```
createListings({ listings: [...], scope }, options)
```

### Parameters

- `listings` — Array of listing objects to create (always an array, even for a single listing)
- `scope` — Optional scope object. If provided, `scope.projectId` is used as fallback and `scope.id` is set as `scopeId`
- `options.forceLocalToRemote` — Push to remote after creation
- `options.updateSyncFile` — Create sync file entries

### Steps performed by useCreateListings

For each listing:

1. **Generate id** — `listing.id ?? nanoid()`
2. **Set projectId** — `listing.projectId ?? scope.projectId`
3. **Process metadata files** — If metadata contains `File` objects, extract them via `getEntityPureDataAndFilesDataByKey`, store them in `db.files`, replace with references
4. **Resolve entityModel** — `listing.entityModel ?? appConfig.entityModelsObject[listing.entityModelKey]`
5. **Set scopeId** — From `scope.id` if scope is provided

Then, for all listings:

6. **Bulk insert** — `db.listings.bulkAdd(listingsClean)`
7. **Create initial entities** — Resolved via `resolveListingsInitialEntities` (e.g. annotation templates)
8. **Create annotation templates** — From `listing.annotationTemplatesLibrary` if present
9. **Remote sync** — If `forceLocalToRemote`, push to remote
10. **Sync files** — If `updateSyncFile`, create sync file entries

### Return value

Returns the array of created listing objects (cleaned, with ids).

## Creation from presets (appConfig)

Preset listings are defined in `appConfig.presetListingsObject`. They are resolved through a single service: **`resolvePresetListings`** (`Features/listings/services/resolvePresetListings.js`).

```
resolvePresetListings({ projectId, scopeId, appConfig, presetListingsKeys })
```

### Parameters

- `projectId` — Required
- `scopeId` — Optional (set on LOCATED_ENTITY / BLUEPRINT listings)
- `appConfig` — App configuration object
- `presetListingsKeys` — Optional array of keys to filter (if omitted, all presets are resolved)

### Steps

1. Clone each preset listing
2. Resolve `entityModel` from `entityModelKey`
3. Apply icon/color/spriteImage defaults from entityModel
4. Check `uniqueByProject` — reuse existing listing id if found
5. Resolve nomenclature if `type === "NOMENCLATURE"`
6. Set `id`, `projectId`, `scopeId`, `canCreateItem`
7. Resolve `relatedListings`, `relatedEntities`, `relatedListing` cross-references (by key)

### Consumers

| Caller | presetListingsKeys | Description |
|---|---|---|
| `useResolvedPresetListings` | all (no filter) | UI display of available presets |
| `useCreateListingsFromPresetListingsKeys` | user-selected keys | Create listings from selected presets |
| `resolvePresetScopeListings` | scope's listing keys | Resolve listings for a preset scope |

## Reading listings

Listings are read from Dexie via hooks:

- **`useListings`** — Live query with filters (project, scope, entityModelType)
- **`useListingById`** — Single listing by id
- **`useListingsByScope`** — Redux selector-based, filtered by current scope
- **`useSelectedListing`** — Currently selected listing

All read hooks include a backward-compatible fallback: if `listing.entityModel` is not stored (old data), it is resolved from `entityModelKey` via appConfig.

## State management

- **Dexie** (IndexedDB) — Source of truth. Listings are stored in the `listings` table
- **Redux** (`listingsSlice`) — Synced mirror via `dexieSyncService`. Stores `listingsById` for selector-based access
- The Dexie → Redux sync is automatic (live query subscription in `dexieSyncService`)
