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
ZONES / business objects / BASE_MAPS displaying a 2D map editor or the 3D
editor; never in the read-only Viewer / Maillage modules; hidden under
capture framing, walk mode, PDF editor, base maps grid, create base map
section. Buttons and hotkeys share this visibility. The layout is per module
(`constants/toolbarLayout.js`, `getToolbarLayout(moduleKey)`): the BaseMaps
module shows its two base map placement commands and the « Repère » group
alone. `DEFAULT_LAYOUT` is ordered by tool family, from the scene context to
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
« Raccourcis » dialog lists the commands under the section labels (« Repère »,
« Fond de plan », « Dessin », « Lignes dans une surface », « Coupes »,
« Soustraction / Évidement », « Faces (3D) », « Créer / modifier depuis la
sélection », « Déplacer / Affichage », « Qualité »). The last button of the
toolbar (`ButtonOpenShortcutsDialog`, not a command) opens that dialog.

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

## Right-click shortcuts (« Raccourcis »)

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
« Raccourcis… » opens the dialog. No menu where the toolbar is hidden
(`useShowCommandsToolbar`). In the 2D editor the right mousedown never starts
a drag (`handleMouseDownCapture` filters `e.button !== 0`).

The **« Raccourcis » dialog** (`components/DialogCommandShortcuts.jsx`,
full page, « Quitter » + `Q` through the shared
`layout/components/HeaderDialogFullPage` / `layout/hooks/useDialogQuitHotkey`
also used by the Configuration dialog): every command of the default layout
by section and group with a checkbox on the left, the ordered recap of the
menu on the right (`ListSortableShortcuts`, dnd-kit drag handle, remove,
« Réinitialiser »). The ordered keys persist per device in the toolbar's
localStorage entry (`commandsToolbar.shortcutCommandKeys`,
`setShortcutCommandKeys` / `toggleShortcutCommand`); default
`constants/defaultShortcuts.js` = `["CHANGE_STYLE"]`, which keeps the former
right-click « change template » gesture one click away.

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
