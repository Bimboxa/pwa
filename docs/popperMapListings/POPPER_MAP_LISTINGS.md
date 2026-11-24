# PopperMapListings

Floating draggable panel that displays listings (annotation template groups) for the selected scope.

## Structure

```
PopperMapListings (Paper, elevation 4)
├── Header
│   ├── DragIndicatorIcon (drag handle — grab cursor)
│   ├── ToggleContentMode ("Annotations | Fonds de plan", plus module sides) or plain title
│   └── IconButtonToggleCollapsed ("Replier" / "Déplier", far right on every side)
├── BandAnnotationsSummary (Dessin popper, annotations side)
│   ├── "X annotations sur N fonds de plan"
│   ├── ToggleButtonCompact
│   └── Properties button (Tune icon → opens PanelPropertiesPopperMapListings)
├── Content (scrollable)
│   ├── SectionLayers (MAP viewer only, togglable via properties panel)
│   ├── ListingRow[] (expandable, with visibility toggle)
│   │   └── AnnotationTemplatesForListing (when expanded)
│   │       └── SortableAnnotationTemplateRow[]
│   │           └── AnnotationTemplateRow (click to draw, eye to toggle visibility)
│   └── Tools section ("Outils de découpe": CUT, SPLIT_LINE, SPLIT_SURFACE, TECHNICAL_RETURN)
└── Dialogs (create listing, calibration, merge compare)
```

## Sides (header toggle)

The header toggle (`ToggleContentMode`, state `popperMapListings.viewerContentMode`) swaps the whole body:

- **Annotations**: the standard body (listings, templates). In the Dessin popper, the `BandAnnotationsSummary` band sits right under the header: "X annotations sur N fonds de plan" (counts from `usePopperBaseMapsCounts`), then the "Compact" toggle and the properties button.
- **Fonds de plan**: the base maps list (`SectionBaseMapsList`) under its `BandBaseMapsSummary` band: "N fonds de plan" on the left, the "Détacher la liste" icon on the right. Detached, the list moves to its own popper (`PopperBaseMapsList`, state `baseMapsListDetached`, same band with the "Attacher aux annotations" icon) and the annotations popper loses its "Fonds de plan" side until the list is re-attached.

The collapse / expand icon button sits at the far right of the header of both poppers; the footer (`PanelFooter`) only keeps "auto" and the resize handle, and is gone while collapsed.

The legend poppers (Viewer, Scope, Maillage, BaseMaps modules) keep their properties button in the header. The docked Dessin panel (`PanelDrawing`) has the same toggle and bands, without detach / compact / properties.

## Viewer Modes

- **MAP viewer**: shows the scope's annotation listings, optional SectionLayers
- **BASE_MAPS viewer**: read-only legend (`selectIsBaseMapsLegendPopper`), shown when the left panel is folded; the annotations side only exists while the module's "Afficher les annotations" switch is ON (base maps list only otherwise)

## Visibility System

Three levels of visibility control:

1. **Per annotation template** (`hidden` field in Dexie): persisted toggle on individual templates
2. **Per listing** (`hiddenListingsIds` in Redux `listingsSlice`): hides all annotations of a listing
3. **Solo mode** (Redux `popperMapListingsSlice`): temporary filter that shows only selected templates without modifying the database. Resets when solo mode is turned off.

### Solo Mode

When active, clicking the eye icon on a template isolates it (hides all others in the listing). Clicking again on the solo template resets the filter. Clicking on a listing eye in solo mode shows all templates of that listing exclusively.

State: `soloMode` (boolean), `soloVisibleTemplateIds` (array or null), `soloListingId` (string or null).

## Properties Panel (PanelPropertiesPopperMapListings)

Accessible via the Tune icon button on header hover. Opens in the right panel (`SELECTION_PROPERTIES` with `type: "SCOPE"`).

Sections:
- **Scope name** (FieldTextV2, editable)
- **Calques**: switch to show/hide the SectionLayers in the popper
- **Visibilité**: switch to enable/disable solo mode

## Key Files

| File | Role |
|------|------|
| `Features/mapEditor/components/PopperMapListings.jsx` | Main floating panel component |
| `Features/popperMapListings/popperMapListingsSlice.js` | Redux slice (showLayers, soloMode) |
| `Features/popperMapListings/components/PanelPropertiesPopperMapListings.jsx` | Properties panel |
| `Features/layers/components/SectionLayers.jsx` | Layers section |
| `Features/listings/listingsSlice.js` | Listing visibility (hiddenListingsIds) |
