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
// {id, listingId, parentId|null, code?, label, color, description?, sortIndex, unit, refQty?, linkingDisabled?, scopeId, projectId}
// linkingDisabled: « Désactiver le bouton relier » (properties panel) — the tree row hides its « annotation + »
relsBusinessObjectAnnotation: "id,projectId,annotationId,businessObjectId,listingId"
// N-N; invariant: at most one live rel per (annotationId, businessObjectId)
```

Both tables: AUDIT + SOFT_DELETE + OWNERSHIP_EXEMPT, no UNDO (zones parity).
Krto: exported via `tablesWithProjectIdAndListingId`; `remapDexieExportIds` gets a
per-table FK override (`businessObjects.parentId → businessObjects`, NOT the global
`parentId → zones` mapping) + `businessObjectId → businessObjects`.
Cleanup: project wipe, scope clear, annotation-delete cascade, listing delete
(`useDeleteBusinessObjectListing`).

## Lien par modèle + exclusions

Deux façons d'alimenter un objet en annotations, fusionnées par
`resolveBusinessObjectAnnotationLinks` (une ligne par paire, jamais comptée deux
fois) :

- **Lien par annotation** : une rel `relsBusinessObjectAnnotation`.
- **Lien par modèle** : `businessObject.linkedTemplateIds = [annotationTemplateId]`
  → toutes les annotations du modèle dans le scope, présentes et futures.
- **Exclusions** : `businessObject.excludedAnnotationIds = [annotationId]`
  (`utils/excludedAnnotationIds.js`) retirent une annotation de l'expansion du
  modèle. Règle : une exclusion ne vaut que si le modèle de l'annotation est lié
  par modèle ; sinon elle est ignorée (on ne soustrait jamais d'un lien par
  annotation). Rel et exclusion sont maintenues mutuellement exclusives par les
  écrivains (exclure supprime la rel de la paire ; lier retire l'exclusion ;
  l'interceptor LINK du dessin ne crée pas de rel pour un modèle déjà lié) ; si
  les deux coexistent malgré tout, la rel gagne. Retirer le lien par modèle
  oublie les exclusions de ses annotations.

Pas de bump Dexie pour ces deux champs (whitelist `useUpdateBusinessObject`,
remap Krto `annotationTemplates` / `annotations`).

UI :
- Mode de pointage sur la carte : `businessObjects.linkingBusinessObjectId` +
  `linkingMode` (`"LINK"` | `"EXCLUDE"`), armé par les icônes « annotation + »
  / « annotation − » (`IconAnnotationLinkAdd` / `IconAnnotationLinkRemove`,
  pentagone + badge) de la ligne de l'arbre et du panneau. Le mode EXCLUDE
  n'est proposé que si l'objet a un lien par modèle ; un clic sur une annotation
  d'un modèle non lié est ignoré (toast). Échap quitte le mode, le mode revient
  à LINK dès que l'id est effacé.
- Le mode est un « mode » comme le dessin : `PopperLinkBusinessObjectHelper`
  (carte `PopperDrawingHelper` : poignée, titre « Liaison / Exclusion — objet »,
  compteur, croix et Échap) **remplace** le popper des listings via la chaîne
  d'early-returns de `PopperMapListings` (après le helper de dessin, qui
  prime). Il n'est plus monté à part dans `MainMapEditorV3`.
- 2D et 3D : le clic est traité par `pickAnnotationForBusinessObjectLinkService`
  (toggle + rafraîchissement des miroirs + toast), appelé par `InteractionLayer`
  (hit DOM) et par `MainThreedEditor.handleClick` (hit raycast, à côté du pick
  de soustraction ; clic dans le vide = no-op, hachures pleines cliquables).
  Échap en 3D : `useBusinessObjectLinkHotkeysInThreedEditor`.
- Section « quantités liées » (`SectionLinkedBusinessObjectsInToolbar`) en bas
  de `ToolbarEditAnnotation(s)` dans les modules objets métier (remplace
  l'ancien bandeau « Associer à ») : sans en-tête, une ligne par objet du type
  du module alimenté par la sélection — libellé, chemin des parents en
  secondaire (« lié par modèle » / « exclue » / « k/N liées »), la quantité
  que la sélection représente dans l'unité de l'objet (formule de l'objet pour
  le modèle si définie, sinon règle par défaut de l'unité ; typo des mesures
  de la toolbar) et « annotation − » qui délie (rel) ou exclut / réintègre
  (lien par modèle, ligne barrée quand exclue). Séparateurs entre les lignes.
  En bas, surlignée secondary light (`selectedBusinessObjectBgcolor`), la
  ligne de l'objet ACTIF (`activeBusinessObjectId`, qui survit à la sélection
  d'une annotation) tant que la sélection ne l'alimente pas entièrement : la
  quantité qu'elle ajouterait (« + 4,8 m² ») et « annotation + » qui lie par
  annotation. Plus de toggle U / L / S ici (formule par défaut de l'unité si
  aucune n'est définie ; le panneau de propriétés garde l'édition).
- Panneau droit : la carte du modèle affiche « k exclues » ; le sous-panneau liste
  les annotations exclues (barrées) avec « Réintégrer », et offre « Exclure » par
  ligne sur un modèle lié.

## Tooltip de survol (tous les modules)

`MapTooltip` (2D et 3D via `ThreedHoverTooltip`) liste, sous un séparateur,
les objets à quantités que l'annotation survolée alimente (rel ou lien par
modèle non exclu, tous types à `features.quantities`, tous modules) : une
ligne par objet — numéro (numérotation d'arbre si `autoNumbering`, sinon le
code), libellé, quantité de l'annotation dans l'unité de l'objet (formule de
l'objet pour le modèle si définie, sinon règle par défaut).
`useAnnotationLinkedBusinessObjectRows`.

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

Rows (`BusinessObjectTreeItem.jsx`, annotation-template rows pattern):
- the label wraps on several lines (rows are top-aligned, side items sit on
  the first line);
- the LEFT SLOT is the SOLO toggle (`SoloIconToggle`, like the template icon):
  the code (listings with codes), else the color chip (colored types, object
  rows), else a grey pentagon. Button shape on row hover, secondary ring while
  soloed; no affordance when the object has nothing to isolate;
- the quantity + unit is flush right, in the measurements typography of
  `ToolbarEditAnnotation` (caption, monospace, 500, `warning.main`).
  Computed quantity when annotations are linked; else `refQty`, greyed; else
  "– unit", greyed; nothing for a unit-less row. The action buttons follow
  it, always visible: documents (resource links), « annotation + » (picking
  mode — hidden when `businessObject.linkingDisabled`, toggled in the
  properties panel), « annotation − » (template link present). No « … » menu on the row:
  the object actions live in its properties panel;
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
- Gitignored org mirrors (`appConfig_edx.yaml`, `Data/edx/configurations/*.js`):
  updated by hand by the user.
