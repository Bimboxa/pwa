/*
 * Shared bookkeeping of a Prompt IA import (project creation from the
 * dashboard, or Krto creation from the "Prompt IA" configuration): the
 * counters shown at the end and the number of progress ticks.
 *
 * Pure: relative imports only, so it runs under `node --test`.
 */

export function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

// Business-object listings (DPGF…) or issues to create in the scope.
export function hasBusinessData(scope) {
  return Boolean(
    scope?.businessObjectListings?.length || scope?.issues?.length
  );
}

export function createImportCounts() {
  return {
    baseMaps: 0,
    scopes: 0,
    listings: 0,
    templates: 0,
    annotations: 0,
    skipped: 0,
    placed: 0,
    documents: 0,
    businessObjects: 0,
    issues: 0,
    qtyGapIssues: 0,
  };
}

/**
 * One unit per task the user can see progressing — satellite reference, base
 * maps, placements, documents, then per scope: the scope itself, its business
 * data and one import per (listing, base map) pair. The project flow adds
 * one unit for the project row.
 *
 * @param {Object} data - parsed output (parsePromptIaProjectOutput)
 * @returns {number}
 */
export function countPromptIaImportTasks(data) {
  const scopes = data?.scopes ?? [];
  const imports = scopes
    .flatMap((s) => s.listings ?? [])
    .reduce(
      (n, l) => n + new Set((l.annotations ?? []).map((a) => a.baseMapId)).size,
      0
    );
  const placements = (data?.baseMaps ?? []).filter((b) => b.placement).length;
  return (
    (data?.site?.reference?.type === "SATELLITE" ? 1 : 0) +
    (data?.baseMaps?.length ?? 0) +
    placements +
    (data?.documents?.length ?? 0) +
    scopes.length +
    scopes.filter(hasBusinessData).length +
    imports
  );
}
