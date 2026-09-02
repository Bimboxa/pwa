# BUSINESS_OBJECTS module ("Ouvrages")

| | |
|---|---|
| **Feature** | Business objects module |
| **Domaine** | `businessObjects` (new) + `App/db`, `viewers`, `layout`, `selection`, `mapEditor`, `krtoFile`, `scopeConfig`, `scopeCreator`, `appConfig` |
| **Statut** | v1 |

## Contexte

The app manages annotation listings (Dessin) whose quantities are read per template.
Business needs a higher-level structure: lists of business objects ("ouvrages") — e.g. a
DPGF breakdown — each rolling up quantities from the annotations linked to it. Annotations
live in their own listings; business objects in theirs; the link is a dedicated N-N
relation table.

## Objectif

A new left-band module `BUSINESS_OBJECTS` (default label "Ouvrages"):

- Manages listings of `entityModel.type === "BUSINESS_OBJECT"`, flagged `isTree: true`
  (v1 handles only tree listings): objects organized as a tree (`parentId` + fractional
  `sortIndex`).
- Object props: **color**, **label**, optional **description**, **unit**
  (`U` | `L` | `S` → u / ml / m², or **null** = unit-less, no quantity shown),
  **isTitle** (title band row). The unit drives the default quantity rollup
  rule: U → count, L → length, S → surface.
- Left panel: listing selector on top (FieldActiveListing pattern), objects tree below.
- Clicking an object toggles its **SOLO display**: the editors show only the
  annotations linked to it **or to its descendants** (relsBusinessObjectAnnotation,
  `useBusinessObjectSoloAnnotationIdSet` → `useAnnotationsV2` filter keyed on
  `selectedBusinessObjectId`, zone-solo semantics: base-map annotations kept,
  `ignoreSolo`/`keepSoloDimmed` honored); the base map switches and zooms to the
  first linked annotation. Re-click restores the full display. The properties
  panel is NOT auto-opened; the solo survives map selections (an annotation
  click shows the annotation props, Escape returns to the object props).
- Linking gestures (both): (a) from a map multi-selection → "Lier à un ouvrage" action in
  the right panel; (b) picking mode armed on an object → click annotations on the map to
  link/unlink (Escape exits). 2D only for (b).
- No hierarchical aggregation in v1: an object only counts its own linked annotations.
- Module editors: `["MAP", "THREED"]` (T toggle), ZONES precedent.

## Modèle de données (db v33)

```js
businessObjects: "id,listingId,projectId,scopeId,parentId"
// {id, listingId, parentId|null, label, color, description?, sortIndex, unit, scopeId, projectId}
relsBusinessObjectAnnotation: "id,projectId,annotationId,businessObjectId,listingId"
// N-N; invariant: at most one live rel per (annotationId, businessObjectId)
```

Both tables: AUDIT + SOFT_DELETE + OWNERSHIP_EXEMPT, no UNDO (zones parity).
Krto: exported via `tablesWithProjectIdAndListingId`; `remapDexieExportIds` gets a
per-table FK override (`businessObjects.parentId → businessObjects`, NOT the global
`parentId → zones` mapping) + `businessObjectId → businessObjects`.
Cleanup: project wipe, scope clear, annotation-delete cascade, listing delete
(`useDeleteBusinessObjectListing`).

## "Numérotation" display option + per-level styles

The object properties panel header has a back arrow navigating to the
listing's properties via the selection slice (`setSelectedItem({type:
"LISTING"})` → `BUSINESS_OBJECT_LISTING` routing, BASE_MAP_LISTING pattern):
`PanelBusinessObjectListingProperties` = name edition + "Numérotation" toggle,
its own back arrow returns to the scope panel. Routing in the module: soloed
object with no other selection → object props; LISTING selection or nothing
selected → listing props (module default); NODE selection → annotation props
(the solo persists underneath).

`listing.showNumbering` (toggled from the listing selector's "…" menu or the
listing properties panel) turns
the tree into a flat 3-column DPGF-like rendering: hierarchical number
(left, computed on the full tree — "2.1.3", every node counts), label (left),
quantity (right); no indentation, no color chip, no link-count chip.

Per-level row styles (both display modes, capped at the 3rd level, see
`BusinessObjectTreeItem.jsx`):
- title rows (`isTitle`): grey band darker at each TITLE nesting level
  (grey.200 → grey.300 → grey.400), bold label (700 at level 0, then 600);
- object rows: white, then greyer at each OBJECT nesting level
  (background.paper → grey.50 → grey.100).

## Quick text edition of the tree

The panel has a quick-edit toggle (EditNote icon under the listing selector)
replacing the tree with a multiline monospace editor: one row per line, TAB
= one depth level (2 spaces tolerated; TAB / Shift+TAB indent/outdent in the
textarea). Trailing suffix: unit in parentheses — `(m)` → L, `(m2)` → S,
`(u)` → U — for object rows; unit in BRACKETS for TITLE rows (`[m2]`, or `[]`
for a unit-less title); no suffix = unit-less object row. The suffix is
authoritative: removing it clears the unit.

"Mettre à jour" runs a diff (`buildQuickEditDiff` in
`utils/businessObjectsQuickEdit.js`) against the live tree:
- matching passes: parent-label+label → label alone → positional pairing
  within the same parent (renames) → cross-parent positional pairing ONLY when
  leftover counts match exactly (rename+move, never mistaking an addition for
  a rename);
- order detection: per sibling group, LIS on old sortIndexes = stable anchors
  keeping their fractional key, the rest regenerated between anchors;
- output: change list (ADD / DELETE / RENAME / MOVE / ORDER / UNIT / TITLE
  chips, with linked-annotation counts on deletions) + plan {additions,
  updates, deletionIds}.

A "x modifications" review section with Confirmer / Annuler applies the plan
in ONE transaction (`applyBusinessObjectsQuickEditService`: deletions cascade
on their rels, bulk add, per-row patches), then a single tick dispatch.

## Krto creation option "DPGF"

The configuration-based Krto creation recap gets an "Options" section with a "DPGF"
checkbox: when checked, the created scope's scopeConfig enables `BUSINESS_OBJECTS`
(removed from `disabledModuleKeys`, row seeded from defaults when the configuration
carries no scopeConfig) and a first business-objects listing named "DPGF" is created.

## Nom de module par scope

`scopeConfigs.moduleLabelsByKey` (`{BUSINESS_OBJECTS: "..."}`) overrides the module
label for the scope. Resolution: scopeConfig > `appConfig.strings.modules.businessObjects`
> "Ouvrages". Editable in the Configuration dialog, module page (BUSINESS_OBJECTS only
in v1).

## Hors périmètre v1

- Hierarchical aggregation (a `qtyRule` field is reserved, never written).
- Non-tree listings (`isTree: false`).
- Custom quantity formulas.
- Scope duplication of business objects (zones parity — neither is copied).
- 3D picking mode (linking in 3D goes through the selection panel).
- Gitignored org mirrors (`appConfig_edx.yaml`, `Data/edx/configurations/*.js`):
  updated by hand by the user.
