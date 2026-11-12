import db from "App/db/db";

import createCutLineLabelSequence from "../utils/createCutLineLabelSequence";

// Label allocator of the cut lines of a scope ("L-01", "L-02", …): reads the
// labels of the existing lines once, then every call of the returned function
// hands out the next one (createCutLineLabelSequence) — one allocator per
// write, shared by the lines of a batch.
//
// Cut lines carry no listing (listingId: null) and annotations are not
// indexed by type / scope: the project's rows are filtered.
export default async function createCutLineLabelAllocator({
  projectId,
  scopeId = null,
}) {
  const rows = projectId
    ? await db.annotations
        .where("projectId")
        .equals(projectId)
        .filter(
          (a) =>
            a.type === "CUT_LINE" && (a.scopeId ?? null) === (scopeId ?? null)
        )
        .toArray()
    : [];
  return createCutLineLabelSequence(rows.map((a) => a.label));
}
