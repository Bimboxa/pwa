import db from "App/db/db";

import { resolveCommentSeed } from "../utils/commentSeedRefs";

import getCommentSeedContextService from "./getCommentSeedContextService";

const stringify = (value) => JSON.stringify(value ?? null);

// Binds the infos seeded by a configuration to the rows of their scope: the
// keys of `comment.seedRefs` (listings, annotation templates, base maps —
// utils/commentSeedRefs.js) are resolved to ids and written in the regular
// fields of the comment (blocks, location, viewContext), the only ones the
// rest of the feature reads.
//
// A key whose target does not exist yet (a page created later by a
// procedure) leaves the comment `seedRefs.pending`: the binding runs again
// when a comment is opened and when base maps / templates appear
// (useBindSeededComments). Idempotent; only the pending seeded comments of
// the scope are read, and only the ones that changed are written (one
// bulkPut).
//
// Returns the number of comments written.
export default async function bindSeededCommentsService({
  projectId,
  scopeId,
} = {}) {
  if (!projectId || !scopeId) return 0;

  const pendingComments = (
    await db.comments.where("scopeId").equals(scopeId).toArray()
  ).filter((c) => !c.deletedAt && c.seedRefs?.pending);
  if (!pendingComments.length) return 0;

  const context = await getCommentSeedContextService({ projectId, scopeId });

  const updated = [];
  for (const comment of pendingComments) {
    const { fields, pending } = resolveCommentSeed(comment.seedRefs, context);
    const next = {
      ...comment,
      ...fields,
      seedRefs: { ...comment.seedRefs, pending },
    };
    const changed =
      pending !== comment.seedRefs.pending ||
      ["blocks", "location", "viewContext"].some(
        (field) => stringify(next[field]) !== stringify(comment[field])
      );
    if (changed) updated.push(next);
  }

  if (updated.length) await db.comments.bulkPut(updated);
  return updated.length;
}
