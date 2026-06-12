import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

// Rename a single maille (mesh cell): persist its display label. An empty label
// reverts to the stable default "M{meshCellNumber}". The number itself
// (meshCellNumber) is never changed — only the display string.
export default async function renameMeshCellService({
  mailleId,
  label,
  dispatch,
}) {
  if (!mailleId) return;

  const trimmed = (label ?? "").trim();
  let nextLabel = trimmed;
  if (!trimmed) {
    const cell = await db.annotations.get(mailleId);
    nextLabel = `M${cell?.meshCellNumber ?? ""}`;
  }

  await db.annotations.update(mailleId, { label: nextLabel });
  dispatch?.(triggerAnnotationsUpdate());
}
