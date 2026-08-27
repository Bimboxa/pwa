import { useMemo } from "react";

import db from "App/db/db";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import BaseMap from "../js/BaseMap";

export default function useBaseMaps(options) {
  // options

  const _filterByProjectId = options?.filterByProject;
  const filterByListingId = options?.filterByListingId;
  // Detail baseMaps (isDetail, rendered on the fly from a PDF) are excluded
  // by default: they must not appear in pickers/trees/3D, and hydrating them
  // in bulk would trigger one full PDF render each. Opt in only for
  // by-id joins (an annotation drawn ON a detail resolving its baseMap).
  const includeDetails = options?.includeDetails ?? false;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapsUpdatedAt = useSelector(
    (s) => s.entities.entitiesTableUpdatedAt?.["baseMaps"]
  );

  // helpers

  const filterByProjectId = _filterByProjectId ?? projectId;

  const hasNullFilterByProjectId =
    options != null && // options exists (not null/undefined)
    Object.prototype.hasOwnProperty.call(options, "filterByProjectId") && // prop is present
    options.filterByProjectId === null; // and its value is exactly null

  // main

  const baseMaps = useLiveQuery(async () => {
    let records;
    if (hasNullFilterByProjectId) {
      return null;
    }
    if (filterByProjectId) {
      records = (await db.baseMaps
        .where("projectId")
        .equals(filterByProjectId)
        .toArray()).filter(r => !r.deletedAt);
    } else {
      records = (await db.baseMaps.toArray()).filter(r => !r.deletedAt);
    }

    if (!includeDetails) {
      records = records.filter((r) => !r.isDetail);
    }

    // filter by listing
    if (filterByListingId) {
      records = records.filter(
        (record) => record.listingId === filterByListingId
      );
    }

    // sort by sortIndex (fractional), fallback to name

    records = records.sort((a, b) => {
      if (a.sortIndex != null && b.sortIndex != null) {
        return a.sortIndex < b.sortIndex ? -1 : a.sortIndex > b.sortIndex ? 1 : 0;
      }
      if (a.sortIndex != null) return -1;
      if (b.sortIndex != null) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });

    // Fetch all versions for these baseMaps in a single query
    const bmIds = records.map((r) => r.id);
    const allVersions = bmIds.length > 0
      ? (await db.baseMapVersions.where("baseMapId").anyOf(bmIds).toArray())
          .filter((v) => !v.deletedAt)
      : [];
    const versionsByBaseMapId = {};
    for (const v of allVersions) {
      if (!versionsByBaseMapId[v.baseMapId]) versionsByBaseMapId[v.baseMapId] = [];
      versionsByBaseMapId[v.baseMapId].push(v);
    }

    const _baseMaps = await Promise.all(
      records.map(async (record) =>
        await BaseMap.createFromRecord(
          record,
          versionsByBaseMapId[record.id] || [],
          // Never render detail images from a bulk hydration (one PDF render
          // each); the single-map selection path (useBaseMap) renders.
          { skipDetailRender: true }
        )
      )
    );
    return _baseMaps;
  }, [
    projectId,
    baseMapsUpdatedAt,
    filterByListingId,
    filterByProjectId,
    includeDetails,
  ]);

  // return — memoize to keep stable reference

  return useMemo(
    () => ({ value: baseMaps, baseMapsUpdatedAt }),
    [baseMaps, baseMapsUpdatedAt]
  );
}
