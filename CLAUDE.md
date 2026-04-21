# CLAUDE.md

## Language rules

- Conversations with the user may be in French, but all code, comments, commit messages, branch names, PR titles, PR descriptions, issue titles, issue descriptions, and review comments must always be written in English.

## Project overview

- PWA built with React 19, Vite 7, Material UI 7, Redux Toolkit 2, Dexie 4 (IndexedDB), Leaflet, Konva, Three.js
- Authentication via Clerk
- Routing via React Router v7

## Project structure

```
src/
├── App/              # Core: store, routing, db, hooks, axiosClient
│   ├── db/           # Dexie database schema, soft-delete middleware, undo hooks
│   └── components/   # MainApp, MainAppLayout
├── Features/         # Feature-based modules (~95 features)
│   └── [featureName]/
│       ├── [featureName]Slice.js   # Redux Toolkit slice
│       ├── components/             # PascalCase .jsx files
│       ├── hooks/                  # camelCase, useXxx.js
│       ├── services/               # Async logic, API calls
│       ├── utils/                  # Helper functions
│       └── data/                   # Static/demo data
├── Data/             # Shared database utilities
└── Styles/           # Theme configuration (theme.js)
```

## Naming conventions

| Type        | Convention                | Examples                                      |
|-------------|---------------------------|-----------------------------------------------|
| Components  | PascalCase `.jsx`         | `FormAnnotation.jsx`, `BlockEntity.jsx`       |
| Hooks       | camelCase, `use` prefix   | `useAnnotationTemplates.js`, `useSelectedEntity.js` |
| Slices      | camelCase + `Slice`       | `annotationsSlice.js`, `entitiesSlice.js`     |
| Utils       | camelCase                 | `getAnnotationBbox.js`, `resolvePoints.js`    |
| Services    | camelCase                 | `createMarkerService.js`                      |
| Directories | camelCase                 | `features/annotations`, `features/entities`   |

## Canonical vs. deprecated components

When a component exists in both a `Xxx` and `XxxStatic` variant, the **`Static` variant is the canonical, active one** — always read, reason about, and modify the `Static` version. The non-`Static` sibling is deprecated and kept only for historical reference.

Examples:
- `NodePolylineStatic.jsx` ← canonical (current renderer for POLYLINE / POLYGON annotations)
- `NodePolyline.jsx` ← deprecated, do not use
- Same rule for any other `NodeXxx` / `NodeXxxStatic` pair in `src/Features/mapEditorGeneric/components/`

## React component structure

### Import order

1. React deps
2. react-redux (`useDispatch`, `useSelector`)
3. Redux actions (from slices)
4. Selectors
5. MUI components (`@mui/material`, `@mui/icons-material`)
6. Custom components (from Features)
7. Utils / helpers

### Section comments inside components

```jsx
export default function MyComponent({ prop1 }) {
  // strings

  // data

  // state

  // helpers

  // handlers

  // render
  return <Box>...</Box>;
}
```

## State management

- **Redux Toolkit slices** for UI state (panels, selections, forms)
- **Dexie + useLiveQuery** for persistent data (entities, annotations, projects)
- Custom hooks combine both (`useSelector` + `useLiveQuery`)

## Styling

- MUI `sx` prop exclusively (no CSS modules, no styled-components)
- Theme defined in `Styles/theme.js`

## Database (Dexie)

- Soft-delete middleware (`deletedAt` field instead of hard delete)
- Audit hooks auto-populate `createdAt`, `updatedAt`, `createdByUserIdMaster`
- Undo/redo hooks on a subset of tables (UNDO_TABLES)
- Use `withHardDelete(fn)` to bypass soft deletes when needed

### Annotation point coordinates — READ THIS BEFORE EDITING `annotation.points`

Point coordinates are stored in a **separate `db.points` table**, **normalized to `[0..1]`** vs `baseMap.image.imageSize`. The `annotation.points` field is just an array of `{id}` references. In React, `useAnnotationsV2` resolves points to **pixel space** via `resolvePoints`.

If you write inline `x/y` to `annotation.points` without going through `db.points`, the change will be silently ignored at read time (`pointsIndex` wins over inline values). If you write pixel values where normalized values are expected, the geometry will jump off-screen at the next read.

Full storage model, write patterns, and common bug signatures: [`docs/annotations/POINTS_STORAGE.md`](docs/annotations/POINTS_STORAGE.md).

## Commit message format

```
[featureName] short description
```

Examples: `[annotations] add split feature`, `[scopeCreator] fix project init`

## GitHub issue workflow

When implementing a GitHub issue:

1. **Create a local branch** with naming convention: `issue_<number>_<keyword>` (e.g. `issue_2_circle_drawing_mode`)
2. **Implement** the feature on that branch
3. **If validated**, merge into `main` with commit message: `[featureName] issue title (#issueNumber)` (e.g. `[annotations] add CIRCLE drawing mode for POLYLINE / POLYGON (#2)`)
4. **Close the GitHub issue** in the merge commit body using `Closes #issueNumber` so it is automatically closed when pushed
5. The user handles the `git push` manually

## Tools

- **Package manager**: npm
- **Build**: `vite build`
- **Dev**: `vite` (with local config)
- **Format**: Prettier (`prettier --check`)
- **Lint**: ESLint 9
