import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";
import { getScopeIdByListingId } from "Features/annotations/utils/isRevolutionHelperInScope";
import { getBaseMapLinkWorldLength } from "Features/baseMaps/js/computeBaseMapLinkCloneGeometry";

import { hydrateBaseMapRecord } from "../services/getHydratedBaseMap";
import {
  isBaseMapLinkClone,
  isBaseMapLinkInScope,
  isBaseMapLinkSource,
  isScopeBoundBaseMapLink,
} from "../utils/baseMapLinkPredicates";

const EMPTY = [];

// Every section mark ("trait de coupe") of the selected scope, whatever the
// plan it was drawn on, with where it is currently located. Read straight
// from Dexie (not from useAnnotationsV2): a mark hidden by its eye keeps its
// row, and the list does not depend on the base map being displayed.
//
// Returns [{ link, clone, planBaseMap, locatedBaseMap, lengthM, isLegacy }]:
// - clone: the live clone on the vertical base map the mark targets
//   (`link.linkedBaseMapId`), i.e. where the mark is located — null when it
//   is not located yet;
// - planBaseMap / locatedBaseMap: { id, name } of the mark's plan and of the
//   base map hosting the clone;
// - lengthM: true length of the mark (null when its plan has no scale — the
//   mark then cannot be located);
// - isLegacy: mark written by the template-based model.
export default function useBaseMapLinksOfScope({ enabled = true } = {}) {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const baseMapsUpdatedAt = useSelector((s) => s.baseMaps.baseMapsUpdatedAt);

  const items = useLiveQuery(async () => {
    if (!enabled || !projectId) return EMPTY;
    const rows = (
      await db.annotations.where("projectId").equals(projectId).toArray()
    ).filter((a) => !a.deletedAt && a.type === "BASE_MAP_LINK");
    if (rows.length === 0) return EMPTY;

    const scopeIdByListingId = await getScopeIdByListingId(rows);
    const links = rows.filter(
      (a) =>
        isBaseMapLinkSource(a) &&
        a.points?.length === 2 &&
        isBaseMapLinkInScope(a, { scopeId, scopeIdByListingId })
    );
    if (links.length === 0) return EMPTY;

    // newest clone per source, on the base map the source targets
    const cloneBySourceId = new Map();
    const linkById = new Map(links.map((l) => [l.id, l]));
    for (const a of rows) {
      if (!isBaseMapLinkClone(a)) continue;
      const source = linkById.get(a.sourceLinkAnnotationId);
      if (!source || source.linkedBaseMapId !== a.baseMapId) continue;
      const previous = cloneBySourceId.get(source.id);
      if (!previous || (a.createdAt ?? "") > (previous.createdAt ?? "")) {
        cloneBySourceId.set(source.id, a);
      }
    }

    // base maps (plans + located elevations) and the marks' points
    const baseMapIds = [
      ...new Set(
        links.flatMap((l) => [l.baseMapId, l.linkedBaseMapId]).filter(Boolean)
      ),
    ];
    const baseMapRecords = (await db.baseMaps.bulkGet(baseMapIds)).filter(
      (bm) => bm && !bm.deletedAt
    );
    const baseMapById = new Map();
    for (const record of baseMapRecords) {
      const versions = await db.baseMapVersions
        .where("baseMapId")
        .equals(record.id)
        .toArray();
      baseMapById.set(record.id, hydrateBaseMapRecord(record, versions));
    }
    const pointIds = links.flatMap((l) => l.points.map((p) => p.id));
    const pointById = new Map(
      (await db.points.bulkGet(pointIds)).filter(Boolean).map((p) => [p.id, p])
    );

    return links
      .map((link) => {
        const planBaseMap = baseMapById.get(link.baseMapId) ?? null;
        const clone = cloneBySourceId.get(link.id) ?? null;
        const locatedBaseMap = clone
          ? (baseMapById.get(clone.baseMapId) ?? null)
          : null;
        const p1 = pointById.get(link.points[0].id);
        const p2 = pointById.get(link.points[1].id);
        const lengthM =
          planBaseMap && p1 && p2
            ? getBaseMapLinkWorldLength({
                planBaseMap,
                planNorm: {
                  p1: { x: p1.x, y: p1.y },
                  p2: { x: p2.x, y: p2.y },
                },
              })
            : null;
        return {
          link,
          clone,
          planBaseMap: planBaseMap
            ? { id: planBaseMap.id, name: planBaseMap.name }
            : null,
          locatedBaseMap: locatedBaseMap
            ? { id: locatedBaseMap.id, name: locatedBaseMap.name }
            : null,
          lengthM,
          isLegacy: !isScopeBoundBaseMapLink(link),
        };
      })
      .filter((item) => item.planBaseMap)
      .sort((a, b) =>
        String(a.link.label ?? "").localeCompare(
          String(b.link.label ?? ""),
          undefined,
          { numeric: true }
        )
      );
  }, [enabled, projectId, scopeId, annotationsUpdatedAt, baseMapsUpdatedAt]);

  return items ?? EMPTY;
}
