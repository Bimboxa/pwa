import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

/**
 * Bulk variant of addAnnotationSubtraction: creates several directional
 * subtraction relations in a single Dexie transaction (one existing-rows read
 * + one bulkAdd), so a click that carves N stacked annotations triggers a
 * single liveQuery refresh instead of N.
 *
 * Applies the same guards as the unit service: no self-subtraction, no
 * duplicate on a non-deleted ordered pair. Duplicates inside `pairs` itself
 * are collapsed too.
 *
 * @param {Object} args
 * @param {string} args.projectId
 * @param {Array<{sourceAnnotationId: string, targetAnnotationId: string}>} args.pairs
 * @returns {Promise<{addedIds: string[], skippedCount: number}>}
 */
export default async function addAnnotationSubtractions({ projectId, pairs }) {
  if (!projectId || !pairs?.length) return { addedIds: [], skippedCount: 0 };

  const pairKey = (p) => `${p.sourceAnnotationId}::${p.targetAnnotationId}`;

  // Drop invalid / self pairs and collapse duplicates within the batch.
  const seen = new Set();
  const candidates = [];
  for (const p of pairs) {
    if (!p?.sourceAnnotationId || !p?.targetAnnotationId) continue;
    if (p.sourceAnnotationId === p.targetAnnotationId) continue;
    const key = pairKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(p);
  }
  if (candidates.length === 0) {
    return { addedIds: [], skippedCount: pairs.length };
  }

  return db.transaction("rw", db.relAnnotationSubtractions, async () => {
    const sourceIds = [...new Set(candidates.map((p) => p.sourceAnnotationId))];
    const existing = await db.relAnnotationSubtractions
      .where("sourceAnnotationId")
      .anyOf(sourceIds)
      .toArray();
    const existingKeys = new Set(
      existing.filter((r) => !r.deletedAt).map(pairKey)
    );

    const toAdd = candidates
      .filter((p) => !existingKeys.has(pairKey(p)))
      .map((p) => ({
        id: nanoid(),
        projectId,
        sourceAnnotationId: p.sourceAnnotationId,
        targetAnnotationId: p.targetAnnotationId,
      }));

    if (toAdd.length > 0) await db.relAnnotationSubtractions.bulkAdd(toAdd);

    return {
      addedIds: toAdd.map((r) => r.id),
      skippedCount: pairs.length - toAdd.length,
    };
  });
}
