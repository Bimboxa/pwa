# PLANNING module — work stations, work packages, global layers and time planning

| | |
|---|---|
| **Feature** | Work packages (sets of linked annotations) + global layers + bottom time planning (Gantt) + per-task planned share |
| **Domaine** | `businessObjects` (PLANNING type), `planning`, `layers` (global layers), `App/db`, `annotations` (useAnnotationsV2 solo / play), `mapEditor` (picking mode), `selection`, `scopeConfig`, `krtoFile` |
| **Statut** | v2 (replaces the v1 "work zones" drawn on the plans) |

## Contexte

The PLANNING business-object type lists tasks ("postes de travail") carrying an
hours ratio (`hoursRatio` h/unit). The need: organize the work **in space**
(work packages = sets of annotations) then **in time** (blocks of resources
on the packages), and measure, per task, the planned share and the progress.

v1 created "work zones" by drawing a delimitation polygon and computing
clipped copies of the drawing; that model made a per-task measure impossible
and was replaced (legacy rows migrated at runtime, see Migration).

## Model — `db.version(35)`

- `globalLayers: "id,projectId,scopeId"` — `{id, projectId, scopeId, name,
  orderIndex}`. Same mechanism as `db.layers` (per base map) but one list per
  scope. `scopeConfigs.layersMode` (`"BASE_MAP"` default | `"GLOBAL"`, switch in
  Configuration › module Dessin › "Calques globaux") picks the table behind the
  SAME layers UI (`useLayers` / create / update / move / delete are mode-aware
  through `Features/layers/utils/layersMode.js`; `useAnnotationsV2` z-order too).
  `annotation.layerId` points at either table; Krto remap tries `layers` then
  `globalLayers`.
- Tasks: `businessObject.globalLayerId` (null = every annotation) — the
  annotation partition the task counts inside a package (`FieldTaskGlobalLayer`
  in the form and the properties panel, `useUpdateBusinessObject` whitelist).
- `workPackages: "id,listingId,projectId,scopeId"` — `{id, listingId (PLANNING
  listing), projectId, scopeId, label, color, sortIndex}`.
- `relsWorkPackageAnnotation: "id,projectId,annotationId,workPackageId,listingId"`
  — invariant: at most one live rel per (annotationId, listingId): the packages
  of a listing partition the drawing (linking to another package REPLACES).
- `planningSlots` re-indexed on `workPackageId` (blocks target a package).

## Work packages (left tab "Work packages", `SectionWorkPackages`)

- A package = its linked annotations. Linking: **picking mode** (AddLink on the
  row / "Mode liaison" in the properties panel → `linkingWorkPackageId`, clicks
  on the map toggle the link, `PopperLinkWorkPackageHelper`, Escape exits —
  InteractionLayer block cloned from the business-object one) or **multi
  selection** → "Lier à un work package" (`SectionLinkAnnotationsToWorkPackage`,
  active PLANNING listing only).
- Tasks of a package: `workStationIds` = the tasks it covers, checked in the
  create / edit dialog and in the properties panel
  (`SectionWorkPackageTasksPicker`; EMPTY = every task of the listing). Among
  them, `useWorkPackageHours` keeps the ones matching ≥ 1 linked annotation
  through their global layer (`taskAppliesToAnnotation`: no layer ⇒ every
  annotation; layer L ⇒ annotations of layer L). Hours(task, package) = qty of
  the matching annotations in the task's ratio unit × ratio. Package budget =
  Σ. Shown under each package row and in `PanelWorkPackageProperties`
  (selection type `WORK_PACKAGE`), with the linked annotations (select /
  unlink).
- Map hover tooltip (`MapTooltip` + `useAnnotationTaskHours`): in a PLANNING
  module it appends, under the quantities, the annotation's work package and
  the hours it represents for each applicable task (same layer + package
  filters, restricted to the ACTIVE task and its sub-tasks when one is
  selected in the "Poste de travail" tab). Nothing is shown for an annotation
  belonging to no work package.
- Hours formatting (`formatHours`): rounded to the unit + man-days at 8 h
  rounded to the half day, "138 h (17,5 Jr.H)"; `{withDays: false}` in paired
  values and narrow columns.
- Row click = SELECT: `setSelectedItem({type: "WORK_PACKAGE", id, listingId})`
  (properties panel) + `businessObjects.activeWorkPackageId` (the Gantt's
  target when creating blocks — persistent, so a map selection never disarms
  it). The row's filter icon owns the SOLO display (`soloWorkPackageId`,
  `useWorkPackageSoloAnnotationIdSet` in `useAnnotationsV2`, mutually exclusive
  with the task solo).
- Deletion: package → its rels + planning blocks (annotations untouched);
  annotation deletion cascades its rel (`useDeleteAnnotations`).

## Per-task planned share ("Poste de travail" tab)

`useTaskPlanningProgress`: total(task) = Σ over packages of hours(task,
package); planned = over the packages carrying ≥ 1 block; done (play mode) =
over the packages DONE at the play step. The task row caption shows
"planifié 62 %" (+ "fait 30 %" while playing).

## Time planning — `src/Features/planning/`

Bottom overlay panel (`PanelPlanningBottom`, `zIndex 5`, resizable), free
resources, CALENDAR / STEPS axis (`planningTimeAxis.js`), blocks per
(resource, package).

The grid is driven by `pointerdown` only, never by `click`: a `click` is emitted
on the common ancestor of the pointerdown / pointerup targets, so after a block
drag it landed on the row band and created a phantom block. Interaction model:

- press an empty band with a package ACTIVE in the left tab → 1-step block (not
  auto-selected, so consecutive presses keep creating);
- press a block → selects it (`planning.selectedSlotId`) and makes its package
  the active + selected one;
- a **selected** block can be moved (steps + resource row) and resized from its
  two handles — left = start (end fixed), right = end (`useSlotPointerDrag`
  modes `move` / `resizeStart` / `resizeEnd`, 3 px threshold, `pointercancel`
  aborts);
- press an empty band while a block is selected → clears the selection only;
- Escape clears the selection, Delete / Backspace removes the selected block
  (window capture + `stopPropagation`, so `InteractionLayer` never sees it;
  bails on editable targets and on `.MuiModal-root`).

Play mode (`SectionPlanningPlayControls`): ‹ › steps, highlighted column, map
styled by package status (`useWorkPackagePlayStatus` → done light grey / in
progress coloured on top / to do and unpackaged very light grey). No "now" line.

## Migration (v34 work zones → v35 work packages)

`migrateWorkZonesToWorkPackagesService` (init, `useInitMigrateWorkZones`,
no-op on a clean db): zone row → package row (same id), the SOURCE annotations
of the zone's computed copies → rels, `planningSlots.workZoneId` →
`workPackageId`, delimitations / copies / delimitation system templates and
the legacy rows hard-deleted (system write, no undo).

## Registration

`AUDIT_TABLES` / `OWNERSHIP_EXEMPT_TABLES` / `SOFT_DELETE_TABLES`, project delete,
scope clear, project export `PROJECT_TABLES`, Krto (`tablesWithScopeId` +
`globalLayers`, `tablesWithProjectIdAndListingId`), `remapDexieExportIds`
(`workPackageId`, `globalLayerId`, `planningId`, `planningResourceId`, layerId
fallback to `globalLayers`), store `planning`.

## Verification

- `scripts/replay/planningTimeAxisReplay.js` (esbuild recipe in the header):
  time axis + `getWorkPackagePlayStatusById`.
- Manual UI (user): switch the scope to global layers, create layers, assign a
  layer to tasks, create packages, link annotations (click / multi-select),
  check the derived tasks and hours, plan blocks, planned % on the task rows,
  play mode styling.

## Hors périmètre v2

Layer-scoped linking (a rel per layer — the annotation's own layer decides);
explicit task selection per package (derived only); several plannings per
listing; overlap rules; undo of planning / package writes; Krnet sync; mobile.
