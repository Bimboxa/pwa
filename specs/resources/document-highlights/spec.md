# Document highlights linked to business objects

| | |
|---|---|
| **Feature** | `resources` / `businessObjects` |
| **Domaine** | resources, businessObjects, pdf, krtoFile, projects, scopes |
| **Statut** | `v1` |

## Contexte

A business object ("Ouvrage") is linked N-N to plan annotations
(`relsBusinessObjectAnnotation`). Users also need to link it to passages of
text documents (CCTP, DPGF…) stored in the RESOURCES panel. Such PDFs are not
plans: converting their pages to images is useless, the text must stay
selectable.

## Objectif

- A PDF resource is either a **document** or a **plan** (`resource.isDocument`).
- In the resource viewer, a document page is rendered with a selectable text
  layer; selecting text offers "Lier à {ouvrage}" for the selected business
  object.
- A highlight **always** belongs to a business object: one row = the link and
  its zone. No base map, no `db.annotations` row.
- The business object properties panel lists its document links in a white
  "Documents" card; a row click opens the document at the page.

## Modèle de données (db v40)

```
relsBusinessObjectResource:
  "id,projectId,scopeId,listingId,businessObjectId,resourceId"

{id, projectId, scopeId,
 listingId,          // the business-objects listing
 businessObjectId,
 resourceId,
 resourceName,       // fallback when the id changed after a re-import
 pageNumber,         // page IN the resource, 1-based
 rects: [{x, y, width, height}],
 text}               // highlighted quote (max 1000 chars)
```

- `rects` are normalized `[0..1]`, top-left origin, in the frame of the page
  at its **intrinsic** rotation (viewer rotation delta = 0). The viewer
  converts with `toDisplayedRect` / `toIntrinsicRect`
  (`Features/resources/utils/rotateNormalizedRect.js`).
- The same passage linked to two objects = two rows.
- Registered in `AUDIT_TABLES`, `OWNERSHIP_EXEMPT_TABLES` (anyone can unlink)
  and `SOFT_DELETE_TABLES`. The private-scope read-only guard applies.
- `resources.isDocument` (boolean, not indexed): set at import by
  `detectIsPdfDocumentService`; rows created before the field are detected at
  first opening (persisted best effort — a resource is only editable by its
  creator). `PDF_PAGE` / `PDF_SOURCE` resources are plans.

## Detection heuristic

`getIsDocumentFromPdfStats` on the first 3 pages: average extractable text
≥ 500 characters per page **and** no page whose long side exceeds 1200 pt
(A3). Overridable with the "Type" selector (Document / Plan) of the resource
detail.

## Viewer

`ViewerPdfPages` renders `ViewerPdfDocumentPage` instead of the page image
when `isDocument`:

- pdfjs canvas fitted to the panel width (× devicePixelRatio), vertical
  scroll; rendered offscreen then copied (no concurrent render on a canvas).
- pdfjs `TextLayer`; its required CSS is written in `sx` (no
  `pdf_viewer.css` import). The layer is sized by pdfjs from the
  `--total-scale-factor` CSS variable and rotated through
  `data-main-rotation`.
- SVG highlights layer **under** the text layer (`mix-blend-mode: multiply`),
  colored with the business object color. **Only the highlights of the
  selected business object are shown** (none without a selected object).
- Text selection → popup "Lier à {code} {label}" (selected business object,
  else the active one). Click on a highlight → popup with "Délier".
- Stable selection: same "end of content" technique as the pdf.js viewer
  (the selection no longer jumps when the cursor hovers an empty area).
- Business objects tree: a hover button on the rows that have links opens
  the document at the highlighted zone (menu when several links) and selects
  the object (`useOpenBusinessObjectDocumentLink`).
- `openResourceAtPage({resourceId, pageNumber, highlightId})` scrolls to the
  highlight and flashes it.

## Krto / export / cleanup

- `createKrtoZip`: table added to `tablesWithProjectIdAndListingId`. The PDF
  file does **not** ship (it stays a project / scope resource); the resource
  metadata row already ships.
- `remapDexieExportIds`: `SIMPLE_FK.resourceId = "resources"`.
- `dedupImportedResourcesBySourceKey`: re-points `resourceId`.
- `createProjectExportZip` (`PROJECT_TABLES`),
  `deleteProjectLocalDataService`, `clearScopeDataService`.
- `useDeleteBusinessObject` soft-deletes the links of the object and its
  descendants.
- Deleting a resource keeps its links: they resolve again by name
  (`resolveResourceOfRelService`) when the PDF is re-imported; meanwhile the
  card shows "Document introuvable" with the quote.

## Vérification

- `node --test src/Features/resources/utils/*.test.mjs`
- Manual: open a CCTP → type "Document" → select an object → highlight a
  paragraph → "Lier à" → object properties → "Documents" card → row click.

## Hors périmètre v1

- Scanned PDFs (no text layer) / rectangle drawn with the mouse.
- Other annotation types (polygon, text, image) on a document page.
- Shipping the PDF file in the Krto zip.
