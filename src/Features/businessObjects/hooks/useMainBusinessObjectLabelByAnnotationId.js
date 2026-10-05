import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";

const EMPTY_MAP = new Map();

// Map annotationId → { businessObjectId, label, color } for every MAIN
// annotation of the project (rels flagged isMain). Consumed by useAnnotationsV2
// to override the displayed label of main annotations with their object's
// name. `color` is only set for the types with the `assignByGeometry` feature
// (locations): their main annotation is the object's zone, drawn in the
// object's color and offering "Affecter les annotations à l'intérieur".
// The Map identity only changes when its CONTENT changes (string version key),
// so the perf-sensitive `processed` memo of useAnnotationsV2 is not
// invalidated by unrelated liveQuery re-runs.
export default function useMainBusinessObjectLabelByAnnotationId() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const relsUpdatedAt = useSelector((s) => s.businessObjects?.relsUpdatedAt);
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );

  const rows = useLiveQuery(async () => {
    if (!projectId) return [];
    const rels = (
      await db.relsBusinessObjectAnnotation
        .where("projectId")
        .equals(projectId)
        .toArray()
    ).filter((r) => !r.deletedAt && r.isMain);
    if (rels.length === 0) return [];
    const objectIds = [...new Set(rels.map((r) => r.businessObjectId))];
    const objects = await db.businessObjects.bulkGet(objectIds);
    const labelById = {};
    objects.forEach((o) => {
      if (o && !o.deletedAt) labelById[o.id] = o.label ?? "";
    });
    const listingIds = [...new Set(rels.map((r) => r.listingId))];
    const listings = await db.listings.bulkGet(listingIds);
    const isZoneListingById = {};
    listings.forEach((l) => {
      if (l && !l.deletedAt)
        isZoneListingById[l.id] = Boolean(
          getBusinessObjectTypeOfListing(l).features.assignByGeometry
        );
    });
    const colorById = {};
    objects.forEach((o) => {
      if (o && isZoneListingById[o.listingId]) colorById[o.id] = o.color || "";
    });
    return rels
      .filter((r) => labelById[r.businessObjectId] !== undefined)
      .map((r) => ({
        annotationId: r.annotationId,
        businessObjectId: r.businessObjectId,
        label: labelById[r.businessObjectId],
        color: colorById[r.businessObjectId] ?? null,
      }));
  }, [projectId, relsUpdatedAt, businessObjectsUpdatedAt]);

  const versionKey = useMemo(
    () =>
      (rows ?? [])
        .map(
          (r) =>
            `${r.annotationId}:${r.businessObjectId}:${r.label}:${r.color ?? "-"}`
        )
        .join("|"),
    [rows]
  );

  return useMemo(() => {
    if (!versionKey) return EMPTY_MAP;
    const map = new Map();
    (rows ?? []).forEach((r) => {
      map.set(r.annotationId, {
        businessObjectId: r.businessObjectId,
        label: r.label,
        color: r.color,
      });
    });
    return map;
  }, [versionKey]);
}
