# Organization AI tasks

AI tasks are loaded lazily from `src/Data/<orgaCode>/aits/index.js` into
`appConfig.aiTasks`. Missing registries produce no shortcut buttons.
Organization Data files are intentionally ignored by Git: provision these files
alongside annotation template libraries in each environment.

The registry exports an array. Each task may live in its own directory:

```js
import goAuto from "./goAuto/task";
export default [goAuto];
```

Example `goAuto/task.js`:

```js
export default {
  id: "go-auto",
  label: "GO auto",
  description:
    "Repérer automatiquement les murs extérieurs, les murs intérieurs et les poteaux du plan.",
  execution: "pdfVectorization",
  prompt:
    "Repère automatiquement tous les ouvrages correspondant aux modèles configurés sur la page PDF source. Exploite les tracés vectoriels du PDF quand ils sont disponibles. Les catégories et types à produire sont exclusivement ceux de la configuration fournie.",
  works: [
    {
      id: "exterior-walls",
      label: "Murs extérieurs",
      type: "STRIP",
      strokeColor: "#ef6c00",
    },
    {
      id: "interior-walls",
      label: "Murs intérieurs",
      type: "POLYLINE",
      strokeColor: "#42a5f5",
    },
    {
      id: "columns",
      label: "Poteaux",
      type: "POLYLINE",
      strokeColor: "#ab47bc",
    },
  ],
};
```

`works` defines the default categories to detect (the older `annotationTemplates`
key is still accepted). Each work has an ID, label, optional description and
preferred type/color for a new template. The chat overlay makes the destination
list and every category → annotation-template mapping explicit. Matching names
and types in the target list are suggested only when unambiguous.

Users can select an existing list or name a new one. Existing templates in that
list are reused as-is; templates selected from another project list are copied.
New templates can be configured with the shared color palette and type icons.
List/template creation is deferred to Execute, in one transaction with stable
IDs per launch. Returning to the discussion preserves the local draft and makes
no database writes. Failed network submissions reuse the frozen launch payload.

The compact category list keeps template mappings, color/type controls and reorder
handles visible. Each row has a details chevron opening a focused work panel for
its description and drawn example. Returning to the list preserves these edits;
execution remains available from the list view. The example uses the
normal map drawing gesture but is intercepted before any annotation write.
Points are stored only in the task draft, normalized in the base map reference
frame. The thumbnail contains a local crop plus the drawn geometry. Neither the
thumbnail nor its data URL is part of the request. The server reverses version
placement, crop and rotation to provide the model with original PDF coordinates.
Escape, cancel, navigation and unmount release the transient drawing capture.

Execution sends the original resource PDF and a frozen destination frame to the
existing vectorization API. The model returns PDF user-space geometry; the server
converts and clips it and emits an absolute-placement live annotations job.
Mapped template IDs are preserved (including multiple categories using one
model); new annotations keep stable IDs per run. Import refuses a changed frame
or deleted/moved mapped templates. No replacement base map is created.

The PDF render must still be identifiable through `createdFrom.versionId`
(or the legacy image filename). The source resource must be available locally
unless it already exists on the configured relay. There is no image fallback.
