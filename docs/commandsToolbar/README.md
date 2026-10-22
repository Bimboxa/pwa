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
