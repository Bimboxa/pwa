# PopperMapListings

Floating draggable panel that displays listings (annotation template groups) for the selected scope.

## Structure

```
PopperMapListings (Paper, elevation 4)
├── Header
│   ├── DragIndicatorIcon (drag handle — grab cursor)
│   ├── Title ("Repérages" or "Dessins sur fond de plan")
│   ├── Properties button (on hover, Tune icon → opens PanelPropertiesPopperMapListings)
│   └── "+ Liste" button (create new listing)
├── Content (scrollable)
│   ├── SectionLayers (MAP viewer only, togglable via properties panel)
│   ├── ListingRow[] (expandable, with visibility toggle)
│   │   └── AnnotationTemplatesForListing (when expanded)
│   │       └── SortableAnnotationTemplateRow[]
│   │           └── AnnotationTemplateRow (click to draw, eye to toggle visibility)
│   └── Tools section ("Outils de découpe": CUT, SPLIT_LINE, SPLIT_SURFACE, TECHNICAL_RETURN)
└── Dialogs (create listing, calibration, merge compare)
```

## Viewer Modes

- **MAP viewer**: shows regular listings (excludes `isForBaseMaps`), optional SectionLayers
- **BASE_MAPS viewer**: shows `isForBaseMaps` listings only, simplified template display (no ListingRow wrapper)

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
