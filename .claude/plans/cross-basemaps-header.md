# Cross baseMaps header in LISTING viewer

## Summary
Add a summary header at the top of `MainListingMapsEditor` that shows a cross-baseMap recap for the selected listing (or all listings when the selector is open).

## Architecture changes

### 1. Refactor annotation loading to `MainListingMapsEditor` level
- Move the `useAnnotationsV2` call from each `SectionBaseMap` to `MainListingMapsEditor`
- Load **all annotations for the listing** once: `useAnnotationsV2({ filterByListingId, excludeIsForBaseMapsListings: true, withQties: true })`
- Filter by `baseMapId` when passing down to each `SectionBaseMap`
- When `showSelector=true` (all listings mode): load all annotations without `filterByListingId`

### 2. Pass `showSelector` and listing data to `MainListingMapsEditor`
- `MainListingViewer` passes `showSelector` prop to `MainListingMapsEditor`
- When `showSelector=true`, `MainListingMapsEditor` uses `useListingsByScope` to get all listings (same filter as `SelectorListingForViewer`)
- Loads annotations for all listings (no `filterByListingId` filter, uses project-level query)

### 3. New component: `SectionCrossBaseMaps`
**Location**: `src/Features/listingViewer/components/SectionCrossBaseMaps.jsx`

**Layout**: Same 2-column layout as `SectionBaseMap` (40% left / flex right)

**Left column**:
- Listing name (title) with its icon
- Button "Voir les données" that opens a `DialogGeneric` fullscreen (`vw="90"`, `vh="90"`) containing `DatagridAnnotations` with all cross-baseMap annotations

**Right column**:
- Same recap as `SectionBaseMap` but with quantities aggregated across ALL baseMaps
- Uses the same `getAnnotationTemplateMainQtyLabel` utility
- Computes `templateQties` from all annotations (not filtered by baseMapId)

### 4. Update `SectionBaseMap` to receive annotations as prop
- Remove internal `useAnnotationsV2` call
- Accept `annotations` prop (already filtered by baseMapId from parent)
- Rest of the component stays the same

### 5. Update `MainListingMapsEditor`
- Add the `SectionCrossBaseMaps` component at the top, before the baseMaps list
- Followed by a `Divider`
- Then the existing baseMaps loop

### 6. Handle "all listings" mode
- When `showSelector=true` and no specific listing is selected:
  - Load all annotations for the project (filtered by excluded types same as `SelectorListingForViewer`)
  - Load all annotation templates (no `filterByListingId`)
  - Show `SectionCrossBaseMaps` with aggregated data
  - Show each baseMap's `SectionBaseMap` with annotations from all listings
  - In the header, show "Toutes les listes" as title instead of a specific listing name

## Files to modify
1. **`MainListingViewer.jsx`** — pass `showSelector` to `MainListingMapsEditor`
2. **`MainListingMapsEditor.jsx`** — load annotations at this level, add `SectionCrossBaseMaps`, filter annotations per baseMap
3. **`SectionBaseMap.jsx`** — receive `annotations` as prop instead of loading internally
4. **NEW: `SectionCrossBaseMaps.jsx`** — cross-baseMap header with recap + "Voir les données" dialog

## No changes needed
- `DatagridAnnotations.jsx` — reused as-is
- `useAnnotationsV2.js` — already supports all needed filter combinations
- `getAnnotationTemplateMainQtyLabel.js` — reused as-is
