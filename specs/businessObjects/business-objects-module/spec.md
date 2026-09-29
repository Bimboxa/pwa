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
- Object props: **code** (article number, free text), **color**, **label**,
  optional **description**, **unit** (FREE TEXT — "m²", "ens", "kg"…, or
  **null** = unit-less, no quantity shown), **refQty** (reference quantity of
  the source document), **isTitle** (title band row). The quantity rollup rule
  is deduced from the unit text (`getBusinessObjectQtyKind`): "m²" / "m2" →
  surface, "ml" / "m" → length, anything else → count. Legacy rows store the
  former enum keys `U` | `L` | `S`, read as u / ml / m² (no migration).
- Left panel: listing selector on top (FieldActiveListing pattern), objects tree below.
- Clicking an object **SELECTS** it: `setSelectedItem({type: "BUSINESS_OBJECT",
  id, listingId})` in the selection slice (row highlight + properties panel,
  force-opened) and `businessObjects.activeBusinessObjectId` — the module's
  ACTIVE object, PERSISTENT where the selection is not (each committed
  location selects the annotation it created, and the popper's "Localisation"
  mode / the LOCATE_BUSINESS_OBJECT target must survive it).
- The row's **filter icon** toggles the object's **SOLO display** (zones drawer
  pattern, `businessObjects.soloBusinessObjectId`): the editors show only the
  annotations linked to it **or to its descendants** (relsBusinessObjectAnnotation,
  `useBusinessObjectSoloAnnotationIdSet` → `useAnnotationsV2` filter, zone-solo
  semantics: base-map annotations kept, `ignoreSolo`/`keepSoloDimmed` honored);
  the base map switches and zooms to the first linked annotation. Re-click
  restores the full display. Display only: the solo survives every selection
  change (an annotation click shows the annotation props, Escape falls back to
  the listing props).
- Linking gestures (both): (a) from a map multi-selection → "Lier à un ouvrage" action in
  the right panel; (b) picking mode armed on an object → click annotations on the map to
  link/unlink (Escape exits). 2D only for (b).
- No hierarchical aggregation in v1: an object only counts its own linked annotations.
- Module editors: `["MAP", "THREED"]` (T toggle), ZONES precedent.

## Modèle de données (db v33)

```js
businessObjects: "id,listingId,projectId,scopeId,parentId"
// {id, listingId, parentId|null, code?, label, color, description?, sortIndex, unit, refQty?, scopeId, projectId}
relsBusinessObjectAnnotation: "id,projectId,annotationId,businessObjectId,listingId"
// N-N; invariant: at most one live rel per (annotationId, businessObjectId)
```

Both tables: AUDIT + SOFT_DELETE + OWNERSHIP_EXEMPT, no UNDO (zones parity).
Krto: exported via `tablesWithProjectIdAndListingId`; `remapDexieExportIds` gets a
per-table FK override (`businessObjects.parentId → businessObjects`, NOT the global
`parentId → zones` mapping) + `businessObjectId → businessObjects`.
Cleanup: project wipe, scope clear, annotation-delete cascade, listing delete
(`useDeleteBusinessObjectListing`).

## Codes ("Renuméroter") + row layout + per-level styles

The object properties panel header has a back arrow navigating to the
listing's properties via the selection slice (`setSelectedItem({type:
"LISTING"})` → `BUSINESS_OBJECT_LISTING` routing, BASE_MAP_LISTING pattern):
`PanelBusinessObjectListingProperties` = name edition + "Renuméroter" action,
its own back arrow returns to the scope panel. Routing in the module is driven
by the SELECTION alone: `BUSINESS_OBJECT` / `WORK_PACKAGE` item → object /
package props; `LISTING` item → listing props; NODE item → annotation props
(the solo persists underneath). With an EMPTY selection the module's active
listing is selected by `useDefaultSelectionInBusinessObjectsModule`, so the
listing props are the module's default — entering the module drops the
selection inherited from the previous one (`selectionSlice` case on
`setSelectedViewerKey`, business-objects modules only).

The numbering is a STORED field: `businessObject.code` (imported, typed in
the object form / properties panel, or written by "Renuméroter"). There is no
computed numbering at display time and `listing.showNumbering` is no longer
read. "Renuméroter" (listing selector's "…" menu or listing properties panel,
`renumberBusinessObjectsService`) writes the tree numbering ("2.1.3", every
node counts) into the codes in one transaction; it is disabled on
Krnet-linked listings, whose codes come from the remote list.

As soon as one object of the listing has a code, the tree turns into a flat
3-column DPGF-like rendering: code (left), label, quantity (right); no
indentation, no color chip, no link-count chip.

Rows (`BusinessObjectTreeItem.jsx`):
- the label wraps on several lines (rows are top-aligned, side items sit on
  the first line);
- the quantity + unit is flush right — the hover actions are an overlay, out
  of the flow. Computed quantity when annotations are linked; else `refQty`,
  greyed; else "– unit", greyed; nothing for a unit-less row;
- when both the computed and the reference quantities exist and differ by
  more than 5 % (`getBusinessObjectQtyGap`), a warning button opens
  `PopperBusinessObjectQtyGap`: reference, computed, gap, and the computed
  quantity per annotation template (`getBusinessObjectQtiesByTemplate`).
- PLANNING rows are unchanged (rolled-up hours on the right).

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
textarea). Trailing suffix: unit in parentheses — a free text, `(m²)`,
`(ml)`, `(u)`, `(ens)`… — for object rows; unit in BRACKETS for TITLE rows
(`[m²]`, or `[]` for a unit-less title); no suffix = unit-less object row. A
suffix is a unit when it is a single token (no space, 16 characters at most):
a label ending with "(type A)" stays a label; `(m2)` / `(m)` are read as m² /
ml; a unit holding spaces is written with non-breaking spaces. The suffix is
authoritative: removing it clears the unit. Codes are not part of the text:
matched objects keep theirs.

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
(added to the configuration's `enabledModuleKeys` before conversion to the persisted
`disabledModuleKeys` row, seeded from the org default when the configuration carries
no scopeConfig) and a first business-objects listing named "DPGF" is created.

## Nom de module par scope

`scopeConfigs.moduleLabelsByKey` (`{BUSINESS_OBJECTS: "..."}`) overrides the module
label for the scope. Resolution: scopeConfig > `appConfig.strings.modules.businessObjects`
> "Ouvrages". Editable in the Configuration dialog, module page (BUSINESS_OBJECTS only
in v1).

## Documents (links to PDF highlights)

The properties panel shows a white "Documents" card
(`SectionBusinessObjectDocuments`) listing the object's links to highlighted
passages of PDF documents (`db.relsBusinessObjectResource`, db v40). Full
model and viewer behaviour:
[`specs/resources/document-highlights/spec.md`](../../resources/document-highlights/spec.md).

## Hors périmètre v1

- Hierarchical aggregation (a `qtyRule` field is reserved, never written).
- Non-tree listings (`isTree: false`).
- Custom quantity formulas.
- Scope duplication of business objects (zones parity — neither is copied).
- 3D picking mode (linking in 3D goes through the selection panel).
- Gitignored org mirrors (`appConfig_edx.yaml`, `Data/edx/configurations/*.js`):
  updated by hand by the user.
