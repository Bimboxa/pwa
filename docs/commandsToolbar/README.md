# Commands toolbar (`src/Features/commandsToolbar`)

The single toolbar gathering every annotation command of the 2D map editor
and the 3D editor: one button + tooltip per command, irrelevant commands
**disabled, never hidden** (the order stays stable), one folder per command.
It replaced three launch points (the « Commandes » side of
`PopperMapListings` / `PopperDrawingTools` / the docked Dessin panel, the
tool buttons of `ToolbarEditAnnotation(s)`, and the quick-action row above the
selected annotation in 2D / 3D).

## Layout

`SectionViewer` renders `CommandsToolbar` once, around the editors area:

- docked `TOP` / `BOTTOM` / `LEFT` (`commandsToolbar.dock`): in-flow strip, the
  editors shrink (LEFT is a column wrapping into columns);
- `FLOATING`: absolute layer inside the editors area, dragged by its grip,
  wrapping on several lines (max 640 px). Released within 24 px of the top /
  bottom / left edge it docks there (`useToolbarDockDrag`).

Dock, floating position and the last-used command of every group persist in
localStorage (`services/commandsToolbarLocalStorage.js`, hydrated in the
slice). Default dock: LEFT (vertical strip). A floating toolbar paints over
the edit poppers (`PanelShowable` is a stacking context).

Visibility (`hooks/useShowCommandsToolbar.js`): the editing modules MAP /
ZONES / business objects / BASE_MAPS / MESHES displaying a 2D map editor or
the 3D editor; never in the read-only Viewer module; hidden under capture
framing, walk mode, PDF editor, base maps grid, create base map section.
Buttons and hotkeys share this visibility. The layout is per module
(`constants/toolbarLayout.js`, `getToolbarLayout(moduleKey)`): the BaseMaps
module shows the « Repère » group, its two base map placement commands and
« Dessiner un trait de coupe » (`DRAW_SECTION_LINE`, 2D editor, horizontal
plans — `Features/baseMapLinks`) alone; the Maillage module (MESHES) shows « Repère » and the « Ligne de
coupe » command (`DRAW_CUT_LINE`, `Features/threedCutLines`) alone.
`DEFAULT_LAYOUT` is ordered by tool family, from the scene context to
the quality tools: « Repère » → base map placement → draw (the templateless
types, then the revolution axis) → lines in a surface → cuts (opening,
segment, surface / face) → topological cuts (subtraction, hollow out) → faces
(extrude, isolate, merge) → create / modify from the selection (clone, merge,
join, walls…) → move / rotate / view toggles of one annotation → quality
(duplicates, cleanup, simplify, arcs). This order is display only: the
registry order of `commands/index.js` drives the hotkey resolution.

The layout is written as **named sections** (`{ key, label, entries }`,
`TOOLBAR_SECTIONS` / `getToolbarSections(moduleKey)`): the toolbar renders
the flat form (`TOOLBAR_LAYOUTS`, a divider between two sections), the
« Commandes » dialog lists the commands under the section labels (« Repère »,
« Fond de plan », « Dessin », « Lignes dans une surface », « Coupes »,
« Soustraction / Évidement », « Faces / Extrusion », « Créer / modifier depuis la
sélection », « Déplacer / Affichage », « Qualité »), followed by the sections
that only exist in the current module's layout (« Coupes / élévations » in
Fonds de plan, « Mailles » / « Lignes de coupe » in Maillage —
`getCommandsDialogSections(moduleKey)`), so their commands can be searched and
ticked for the right-click menu of that module. The last button of the
toolbar (`ButtonOpenCommandsDialog`, not a command) opens that dialog.

« Dessiner un trait de coupe » (`DRAW_SECTION_LINE`) arms the two-click draw
of a section mark (`BASE_MAP_LINK`): a template-less helper of the scope,
visible and editable in the Fonds de plan module only, labelled « A-A »,
« B-B »… It is **not** gated by `getDrawToolsGate` (that module forces the
SELECT interaction mode for its listings popper). The mark is then located
on a vertical base map from the « Traits de coupe » section of the listings
popper — the drawing helper is titled « Repérage du trait de coupe » and
carries the « Adapter l'échelle » switch (off: the base map keeps its scale,
1st click = anchor, 2nd click = direction) — which poses that base map in 3D
(`resyncBaseMapLinkPlacementsService`).

« Grille » (`TOGGLE_GRID`, 2D editor, section « Grille ») is always the
**first** command of the default and Fonds de plan layouts: it toggles the
editor grid (metric grid over the current base map, snap target while drawing
/ moving), its small arrow opening the cell size and « Grille dynamique »
options — see `docs/editorGrid/README.md`.

The « Repère » group (3D only, `PLACE_AXES` / `TOGGLE_AXES` / `RESET_AXES`)
drives the user frame of the 3D editor (`threedEditor.axesSettings`, a device
preference): « Orienter le repère » is a 2-click tool
(`Features/threedAxesPlacement`: origin, then X axis direction, the in-scene
axes rotating live), « Afficher le repère » toggles the in-scene axes and
« Réinitialiser le repère » puts the frame back to the world origin with no
rotation. The frame origin is a snappable point of every 3D tool while the
axes are shown.

The « Nettoyage » group (`CLEAN` / `REPAIR`, « Nettoyer » as default slot):
« Nettoyer » purges the deleted annotations of the current scope (soft-deleted
tombstones, orphan points, dead mesh paints — `purgeDeletedAnnotationsService`,
the same service as « Purger les suppressions » in the 2D editor settings)
after a confirmation dialog that announces the counts (dry run); « Réparer la
géométrie » repairs the selected line / surface / strip.

« Ajouter les points d'intersection » (`ADD_INTERSECTION_POINTS`, section
« Créer / modifier depuis la sélection »): with exactly two lines / surfaces
selected, inserts a vertex in BOTH annotations at every crossing of their main
rings (`findPolylineIntersections`: arcs sampled then refined on the exact
circle). The two annotations share one point id per crossing (one `db.points`
row, the junction convention), arcs are preserved through `splitArcOnInsert`,
the per-segment flags are remapped, the hosted openings reflow and the whole
write is one undo step. Cuts / guide lines are not crossed, and
`meshLinesBySegment` is not remapped (like the other insertion paths).

## Right-click shortcuts and the « Commandes » dialog

A right click in the 2D editor (`InteractionLayer.handleContextMenu`) or the
3D editor (`MainThreedEditor.handleClick`, `event.button === 2` — a right
drag stays the camera pan) opens the **shortcuts menu**
(`components/MenuCommandShortcuts.jsx`, rendered by `CommandsToolbar`, the
only owner of `ctx` / `deps`): the user's ordered shortcut commands as menu
items, rendered exactly like a group menu (`CommandSlot` under
`CommandMenuContext`), so a `run` command fires and a popup-owning command
opens its popup on the menu anchor (the menu is `keepMounted`). Before the
menu opens, the right-clicked annotation becomes the selection unless it
already belongs to it (a multi-selection containing it is kept); a right
click on empty keeps the selection. The anchor travels through
`contextMenu.anchorPosition` (`Features/contextMenu/contextMenuSlice.js`,
`closeContextMenu` on close); the menu element is a 1×1 fixed anchor portaled
to body. Only the shortcuts present in the module's layout are listed; a
non-relevant command stays visible, disabled with its reason. The footer
« Commandes… » opens the dialog. No menu where the toolbar is hidden
(`useShowCommandsToolbar`). In the 2D editor the right mousedown never starts
a drag (`handleMouseDownCapture` filters `e.button !== 0`).

The **« Commandes » dialog** (`components/DialogCommands.jsx`, full page,
« Quitter » + `Q` through the shared `layout/components/HeaderDialogFullPage`
/ `layout/hooks/useDialogQuitHotkey` also used by the Configuration dialog;
opened by `ButtonOpenCommandsDialog` / the menu footer,
`commandsToolbar.commandsDialogOpen`) is the reference list of every command
of the default layout, by section and group (`RowCommand`: checkbox, icon,
label, `CommandBadges` = 2D / 3D chip + hotkey letter):

- **search** — a `SearchBar` in the header highlights (`RowCommand.highlighted`:
  `alpha(secondary.main, 0.12)` band + 3px secondary left bar, the selected
  row look of the Contenu tab) the rows matching the label or the helper
  description (`utils/matchesCommandSearch.js`: accent- and case-insensitive,
  every typed word must match); the layout is never filtered, the sections
  stay as landmarks, no match shows a message above the list. The `Q` quit
  letter yields while typing (`isEditableTarget`).
- **helper « i »** — when the org provides a helper for the command, an
  info button at the end of the row opens `DialogCommandHelper` (nested MUI
  dialog: the gif, lazy through `useDataImageUrl`, above the Markdown
  description rendered by `commandHelperMarkdownComponents.jsx` — no images
  in the body). No helper, no button. Helpers come from
  `hooks/useCommandHelpers.js` ← `appConfig.features.commandHelpers`.
- **right-click menu** — the checkbox of a row = offered in the menu; the
  ordered recap on the right (`ListSortableShortcuts`, dnd-kit drag handle,
  remove, « Réinitialiser »). The ordered keys persist per device in the
  toolbar's localStorage entry (`commandsToolbar.shortcutCommandKeys`,
  `setShortcutCommandKeys` / `toggleShortcutCommand`); default
  `constants/defaultShortcuts.js` = `["CHANGE_STYLE"]`, which keeps the
  former right-click « change template » gesture one click away.

### Command helpers (`Data/<org>/commands/`)

Per-org, gitignored, resolved by `appConfig/utils/resolveAppConfig.js`
(`COMMAND_HELPERS_MD_LOADERS`, eager raw Markdown) into
`features.commandHelpers = { basePath: "commands", byKey }`. One file per
command key of the registry:

```
src/Data/edx/commands/
├── CHANGE_STYLE.md
├── CLONE.md
└── assets/
    └── change_style.gif
```

```md
---
gif: ./assets/change_style.gif
---
Applique un autre modèle d'annotation aux annotations sélectionnées…
```

The YAML frontmatter is optional (`gif`, path relative to the `commands`
folder, resolved by `resolveTutorialImagePath` and loaded through the
`Data/**/*.{png,jpg,jpeg,webp,gif}` glob of `dataImageUrlLoaders.js`); the
body is the description (Markdown, searched by the dialog). A file with a
frontmatter only shows the gif alone; a file with neither description nor
gif is dropped (no « i »).

### « Axe de révolution » / « Axe sur plan de coupe »

`commands/revolutionAxis/` (`REVOLUTION_AXIS`, hotkey A) draws a new axis on
a horizontal plan or on a horizontal base map plane of the 3D editor; on a
VERTICAL base map it is disabled with a reason pointing to the next command.
`commands/placeRevolutionAxis/` (`PLACE_REVOLUTION_AXIS`, 2D only, inverted-T
icon `IconPlaceRevolutionAxis`) poses an EXISTING axis of the scope on the
current vertical base map (coupe / élévation): its `Button` always opens a
menu of the scope's axes (`useRevolutionAxes`), disabled while the scope has
none; picking one arms the one-click `REVOLUTION_AXIS_PLACE` tool
(`startPlaceRevolutionAxis`, shared file `revolutionAxis/startRevolutionAxisTools.js`),
whose click creates the `REVOLUTION_AXIS_PLACEMENT` and poses the base map
in 3D. Both commands sit at the end of the « Dessin » section.

### « Changer de style » (`CHANGE_STYLE`)

`commands/changeStyle/`: re-templates the selected annotations (same drawing
shape — `useChangeAnnotationsTemplate`, the batch sibling of
`useChangeAnnotationTemplate`, diff-only patch per compatible row). Two
behaviours in `ButtonChangeStyle` (`useCommandMenu()`):

- in a menu (right-click shortcuts, group menu): the item acts on the
  selection now (selection gate) and opens `MenuPickChangeStyleTemplate` on
  the menu anchor — candidates compatible with at least one selected row, the
  common template highlighted, « · n » suffix on a mixed selection;
- in the toolbar row: toggles the `CHANGE_STYLE` drawing mode
  (`mapEditor.enabledDrawingMode`, constant in `changeStyleMode.js`). The
  drawing helper (`SectionChangeStyleHelper`, through
  `SectionDrawingHelperContent` — docked panel, floating popper, 3D panel;
  title « Changer de style » via `mapEditor/utils/selectDrawingHelperTitle`)
  lists the selection grouped by template and holds the « Changer le style »
  button. A click selects an annotation (shift toggles it,
  `POINTER_CLICK_MODES` / `NO_SMART_DETECT_MODES`, draggables select without
  moving), a click on empty does nothing, Escape leaves the mode and keeps the
  selection; the mode stays armed after a change. The 3D editor ignores this
  2D mode flag: its clicks select as usual.

### « Ajouter un profil » (`ADD_PROFILE_LINE`)

`commands/addProfileLine/`: built by `createPolygonLineCommand` (2D, host
POLYGON / POLYLINE) with a `Button` (`ButtonAddProfileLine`) opening an
intermediate menu on the click anchor:

- « Dessiner un profil » arms the `ADD_PROFILE_LINE` drawing mode (`run`, the
  only behaviour of the hotkey / shortcuts path; a click while armed disarms
  without the menu);
- « Profils existants »: the project's annotations flagged « Profil »
  (`annotation.isProfile`, `annotations/utils/listProfileAnnotations`, shared
  with the Élévation « Choisir un profil » button). Picking one calls
  `applyProfileFromAnnotationService` on the selected POLYLINE (seed segment
  0) and sub-selects the new profile line; on a POLYGON host the items are
  disabled (« Réservé aux lignes », the service's contract).

### « Extruder le long d'une ligne » (`EXTRUDE_ALONG_LINE`)

`commands/extrudeAlongLine/` (2D + 3D, next to « Extruder », no hotkey): the
selected POLYLINE is the PROFILE. `run` arms the sweep pick mode
(`mapEditor.sweepProfileAnnotationId`, `mapEditor/utils/sweepPickMode`,
exclusive with the subtraction picks, blocks the plain-letter hotkeys) and
clears the selection; the helper `PopperSweepAlongLineHelper` replaces the
listings popper (chain of `PopperMapListings`, `FloatingHelpersDessin` when
the Dessin panel is docked, the 3D viewers). The next click on an annotation
— 2D `InteractionLayer`, 3D `MainThreedEditor.handleClick` (nearest hit) — is
the GUIDE (POLYLINE / POLYGON): `annotations/services/sweepAlongLineService`
creates a third POLYLINE = independent copy of the guide's ring + the profile
as `profileLines[0]` (the inline-extrusion 3D build), tagged
`sweepSources: { guideAnnotationId, profileAnnotationId }`, template = the
profile's (templateless profile → templateless result, its style copied;
« Changer le modèle » works as usual; a template-level « Profil » flag no
longer hides a swept annotation from the 3D scene). One shot: the result is
selected and the mode exits; a wrong target keeps it armed (toaster), an
empty click or Escape cancels. Profile registration: a « Point de référence »
on the profile → elevation reading (`applyProfileFromAnnotationService`, X =
abscissa, Y = height, seed segment nearest to the base point); none → the
profile stays in place (its plan vertices + vertex offsets as heights, same
base map required). `ToolbarEditAnnotation` shows a « Extrudé le long d'une
ligne » row (`RowSweepSourcesRefresh`) whose « Actualiser la 3D » rebuilds
the ring from the guide and re-applies the profile
(`refreshSweepAlongLineService`, one undo step).

### « Fusionner les annotations » (`MERGE`)

`commands/merge/` (2D + 3D, SELECTION group, no hotkey): merges the selected
annotations into one. Hybrid, resolved by the pure
`resolveMergeSelection.js` (`resolveMergeTarget(ctx)` → `{ mode: "2D" |
"MESH", annotations: [seed, …] }` or an `unavailable` reason):

- **2D** (`useMergeAnnotations`, unchanged): lines only or surfaces only, no
  mesh, and in the 3D editor the same `offsetZ` / `height`, no vertex
  offsets, same stroke width for polylines — the result stays a parametric
  annotation.
- **MESH** (3D editor only, `threedMergeFaces/services/mergeAnnotationsToMeshService`):
  the seed receives the union mesh (`writeMesh3dService`, becomes / updates
  its `isMesh3d`), the others are deleted, one undo step. Any contact counts
  (face, edge, vertex); two closed solids whose volumes overlap are unioned
  by CSG, the rest by the planar merge of `mergeMesh3dSolids`; disjoint
  objects are refused with a toast. In the 2D editor the button is disabled
  with « Fusion en maille disponible dans l'éditeur 3D ».

Template rule (both modes, `resolveMergeTemplate`): one template at most —
all alike, all template-less, or one template plus template-less shapes,
which take it (the seed is the first selected annotation carrying it). The
former `templateIds.size !== 1` gate refused template-less selections.
Details and limits: `src/Features/threedMergeFaces/README.md`.

## Command contract

`commands/<name>/<name>Command.js` — pure metadata, no hook:

```js
export default {
  key: "HOLLOW_OUT",
  label: "Évider (…)",            // tooltip + menu text
  Icon: IconHollowOut,            // component (or `icon` element on variants)
  editors: ["2D", "3D"],          // default both; elsewhere disabled with a reason
  hotkey: { key: "e", editors: ["2D"], plainOnly, yieldWhen(state, ctx), showBadgeWhen(ctx) },
  getState: (ctx) => ({ enabled, reason?, active? }),   // PURE
  run: (ctx, { dispatch, store, getThreedEditor }, variantKey?) => void,
  Button: ButtonHollowOut,        // OR a component for popup / hook commands
  variants: (ctx) => [{ key, label, Icon | icon }],     // split button
  getActiveVariant: (ctx) => variant,
};
```

Rules (asserted in dev by `commands/index.js`):

- unique keys; every command appears in at least one layout of
  `constants/toolbarLayout.js`, at most once per layout;
- a command with a `hotkey` has a pure `run` (the window listener calls it
  outside React); a popup-owning command exposes `Button` (`{ command, ctx,
deps, state, hotkeyLabel }`) and **never returns null** — it renders
  `CommandButton` with `state.enabled = false` + reason instead;
- a `Button` reads annotations / base map / permissions from `ctx`, never
  through its own `useAnnotationsV2` / `useMainBaseMap`; template pickers go
  through `MenuPickAnnotationTemplate` / `ListPickAnnotationTemplate` (their
  queries only run while the popup is open);
- popups anchor on the `anchor` argument of `onClick(event, anchor)` (the
  group button when launched from a group menu), never `event.currentTarget`.

Shared `getState` bricks: `utils/drawToolCommandState.js` (drawing tools:
`showDrawingTools`, armed draw / 3D tool), `utils/selectionCommandState.js`
(selection: loading, editable, types, targets; 3D meshes — `isMesh3d` — are
excluded unless the command only writes a relation and opts in with
`allowMesh3d`: SUBTRACT / SUBTRACT_FROM),
`utils/createToolGroupCommand.js` (a `DRAWING_TOOLS_BY_TYPE` group with its
variants), `utils/createPolygonLineCommand.js`, `utils/createViewToggleCommand.js`.

## Context (`hooks/useCommandsContext.js`)

One `ctx` object per toolbar render: editor / module, interaction modes, the
resolved selection (`selectedAnnotations`, `selectedAnnotation` with its
template, `selectedPart`, `facePart`, `annotationsLoading`), `baseMap` /
`meterByPx` / `hasScale`, `selectionEditable` / `readOnlyReason`, the armed
draw (`enabledDrawingMode`, `activeToolType`) / 3D tool, the view toggles.
It holds the single `useAnnotationsV2` / `useMainBaseMap` /
`useAnnotationPermissions` of the toolbar.

## Hotkeys (`hooks/useCommandsHotkeys.js`)

One window keydown listener (capture): for the pressed letter, in registry
order, the first command whose hotkey matches the displayed editor, whose
shared guard passes (`utils/canFireCommandHotkey.js`: no modifier, no
repeat, no text input, no open popup, no armed draw / paste / subtract, no
walk, no docked template detail), whose `getState` is enabled and whose
`yieldWhen` does not yield, runs and consumes the event. Each render
publishes the claimed letters (`utils/hotkeyClaims.js`);
`useRightPanelToolHotkeys` yields on them (E = Évider 2D / Extruder 3D,
A = Axe…).

Several commands may share a letter: each one yields (`yieldWhen`) when it is
not the one to fire and badges the letter only then (`showBadgeWhen`) — the
11 « Dessiner — … » commands (`utils/createTemplatelessDrawCommand.js`) share
« D », which draws the last-used templateless type.

## Adding a command

1. `commands/<name>/<name>Command.js` (+ `Button<Name>.jsx` if it owns a
   popup or needs hooks) following the contract above.
2. Register it in `commands/index.js` (order = hotkey resolution order).
3. Place it in `constants/toolbarLayout.js` (alone, or in a group).
