# PDF editor layer

| | |
|---|---|
| **Feature** | `pdfEditor` |
| **Domaine** | pdfEditor, resources, businessObjects, layout, hotkeys |
| **Statut** | `v1` |

## Contexte

Business objects are linked to passages of PDF documents (CCTP, DPGF…)
through `db.relsBusinessObjectResource` (see
`specs/resources/document-highlights/spec.md`). The document used to open in
the RESOURCES right panel: narrow reading area, and the panel took the place
of the tools.

## Objectif

- A central PDF reader: a **layer** sliding up from the bottom **over the
  displayed editor** (2D or 3D), covering the whole editors area and staying
  **under the right tools panel**.
- Opened **only** by the document links of the business objects (the
  "Documents" card of the properties panel, the document button of the tree
  rows). PDF only: any other file still opens in the RESOURCES panel.
- On the page: the highlighted passages of **every** business object,
  coloured by object. A click on a passage selects its object.
- One control (the "pill" of the header): an eye showing / hiding the
  highlights, and a list button opening a "sommaire" popper of the passages.
- The pages **really scroll**: every page of the document in one continuous
  scroll area (no jump from page to page), zoomable.

## Architecture

The layer is redux-driven (`pdfEditorSlice`), **not** an editor key of the
module / editor model: the editor underneath stays mounted and
`selectEffectiveViewerKey` is untouched.

```
pdfEditor: { open, resourceId,
             targetPdfPage,        // one-shot {pageNumber, highlightId}
             showHighlights,       // session
             passagesPopperOpen }
```

- `LayerPdfEditor` is mounted by `SectionViewer` in the editors box, as
  `<Slide direction="up" mountOnEnter unmountOnExit>` around an absolute
  `inset: 0` box. **zIndex 40**: above the editors (0), the planning panel /
  base maps grid (5), the hover left drawers (20), the capture / POV bars
  (30); under the right drawer (200) and band (300).
- `PdfEditorContent` is keyed by resource id (page, rotation, zoom and
  search start fresh with each document). The layer never hands it a stale
  resource: the live query keeps the previous row while the next one loads,
  and the content would consume the navigation target of the new document.
- `closePdfEditor` keeps `resourceId`, so the content does not blank during
  the slide-out; the unmount on exit destroys the pdfjs document.
- Lifecycle: closed by its button, Escape (the popper first), a scope /
  project change (full reset) and a module switch — except towards a
  business-objects module or the Viewer (`THREED`), the modules it is opened
  from (a highlight click may switch between them).

## Shared viewer code (`Features/resources`)

- `usePdfPagesViewerState`: the state of a page-based PDF viewer (parsed
  document, page, rotation delta, thumbnails, text search, one-shot target),
  extracted from `ViewerPdfPages` and used by both viewers. Each one owns its
  target in redux (`resources.targetPdfPage` / `pdfEditor.targetPdfPage`).
  `withPageImage: false` for the continuous viewer (it renders every page).
- `useResourceIsDocument`: document vs plan rule + legacy detection,
  extracted from `PanelResourceDetail`.
- `PdfDocumentPageSheet`: ONE page box — pdfjs canvas, text layer,
  highlights, "Lier à" / "Délier" popups. Its parent owns the scroll area and
  the scale:
  - `ViewerPdfDocumentPage` (RESOURCES panel): one page fitted to the panel
    width (`scale` = a resolver of the page viewport, `scaleKey` = the width);
  - `ViewerPdfPagesScroll` (PDF editor): every page in one scroll.
  Options: `showAllBusinessObjects`, `hideHighlights`, `interactive: false`
  (plan pages: no text layer nor highlights), `boxSize` (layout size known
  before the render: the canvas stretches to it, so a zoom shows at once and
  sharpens after `renderDelayMs`), `flashHighlightId` + `flashNonce` (the
  nonce restarts the flash on a repeat target), `onHighlightClick(rels)`.
  The canvas density is capped (~16 M px).

## Continuous viewer (`ViewerPdfPagesScroll`)

- **Layout**: `usePdfPagesBaseSizes` reads the size of every page up front
  (page dictionaries only), so the stack has its final height before any
  page renders. Geometry is pure and tested
  (`utils/pdfPagesScrollLayout.js`). Only the sheets crossing the viewport
  (± one viewport) are mounted; blank placeholders stand for the others.
- **Scale**: `zoom` 1 = the largest page fits the area entirely
  (`getPdfPageFitScale`, "page" mode). The width is the client width with a
  stable scrollbar gutter, the height the outer height: the fit never depends
  on a scrollbar showing up.
- **Page number, two-way**: scrolling reports the page showing the most (the
  current page keeps the title on a tie — two whole pages on screen, end of
  the document); a page number set from outside (thumbnail, arrows, search
  result, target) jumps to the top of that page. `syncedPageRef` tells the
  two apart.
- **Zoom**: header buttons (stops), Ctrl / Cmd + wheel and trackpad pinch
  (continuous, around the pointer — native non-passive wheel listener). Any
  layout change (zoom, rotation, resize) keeps an anchored point still: the
  anchor is taken in the PREVIOUS layout (`layoutRef` only moves in the
  layout effect).
- **Targeted passage**: scrolls to it once per `(flashHighlightId,
  flashNonce)`, after the jump to its page.

## Header

Every control sits on the left (the right tools panel floats over the right
side): close, document selector (PDF resources visible from the scope), page
← n / N → (also ← / → keys; the other keys scroll natively), rotation ±90°
(whole document), zoom (0.5 – 4, reset = whole page), highlights pill. A fixed-width right tool (Propriétés…) insets the
content by its width so the page stays readable beside it.

## Selecting a business object from a highlight

`useSelectBusinessObjectFromPdfEditor` — the properties panel only routes to
a business object inside a business-objects module:

- current module is not one (Viewer): plain `BUSINESS_OBJECT` selection;
- module of the object's type: active listing (only if it differs), active
  object, selection, properties panel;
- another business-objects module: `useOpenBusinessObject` (module switch).

## Keyboard

There is no central hotkey registry, and a capture listener cannot pre-empt
the ones registered before it. The handlers that would act on the hidden
editor check `selectPdfEditorOpen`: `InteractionLayer` (main key handler),
`useUndo`, `useDrawingToolHotkeys`, `useToggleThreedViewerHotkey`,
`useWalkMode`, `useDeleteAnnotationOnKeyboardInThreedEditor`,
`PlanningGrid`, `useOpenBaseMapsGridHotkey`, and the Capture letter of
`useRightPanelToolHotkeys`. The Dessin-only hotkeys need no guard (entering
Dessin closes the layer). The other right-panel tool letters and the
Ctrl+letter module switches stay active.

## Vérification

- `node --test src/Features/resources/utils/*.test.mjs src/Features/pdfEditor/utils/*.test.mjs`
- Manual: business-objects module → object → "Documents" card → row click →
  the layer slides up at the page, passage flashed; eye → highlights hidden;
  scroll → the pages follow each other, the page number and the selected
  thumbnail track the scroll; Ctrl + wheel / pinch → zoom around the pointer;
  list → popper, row click → page + flash; click on a highlight of another
  object → its properties; Escape → closed; Dessin module / scope change →
  closed; RESOURCES panel viewer unchanged.

## Hors périmètre v1

- Opening the layer from a global button or from the RESOURCES panel.
- DETAIL annotations ("Voir le détail"): still the RESOURCES panel.
- Text selection spanning two pages (one highlight = one page).
