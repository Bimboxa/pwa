# Chat annotation batches

The relay exposes `query_annotations` and `update_annotations_batch` to both MCP
and ordinary chat. Automatic detection cannot call these tools. Deploy both the
relay and this PWA build before using the feature. No production deployment is
performed by the source changes.

Queries execute in the connected PWA against persisted annotations and the same
template-property resolver used by the editor. The target listing, project,
scope, base map, image version and calibration are frozen. Hidden annotations
are excluded by default; `includeHidden` explicitly includes them. Querying has
no domain mutation. A query receipt holds every matched ID and the full row and
template fingerprints; the model sees a count and at most 20 samples. More than
2000 matches fails rather than silently truncating the selection.

Updates reference these query job IDs. All groups commit in one Dexie transaction
with their before values and a durable local receipt. One Redux refresh follows
commit. Supported changes: isExt, height, offsetZ, CM/PX stroke widths and hex
stroke/fill colors. Relative offsets and lightening (default 15% toward white)
are deterministic. All fields imposed by a template are rejected; shared
templates are never changed. Missing isExt is unknown, not implicitly interior.

Changing a row or template since selection, moving/deleting a target, changing
the plan frame, overlapping groups or an ownership failure rejects the entire
batch. Select again after fixing the conflict. A query selection can only be
consumed once. Same-job delivery returns its saved result without writing again.
An applying job with a local receipt can be acknowledged after reload; an
applying job without a receipt is never replayed automatically.

The chat Undo button restores the batch, as does the editor undo stack (one
entry, with redo). Both refuse to overwrite subsequent edits or template changes.
Browser-local `annotationBatchReceipts` (Dexie schema 38) must be retained for
recovery and undo. Clearing browser data loses this history; queries and updates
must execute in the same browser database. Undo-stack entries remain in memory
as before; chat undo can use durable receipts after reload.

This guarantees local transaction atomicity only. The existing remote scope
synchronization mechanism is unchanged.

Validation: `node --test src/Features/assistantRelay/services/annotationBatchService.test.mjs`
uses Dexie with fake-indexeddb, exercising actual transactions and rollback.
