import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";

/**
 * Live painted mesh parts of the selected project + the RAW rows they depend
 * on. Never goes through useAnnotationsV2: a host whose own template / listing
 * is hidden is dropped there, while its paints must stay visible (and
 * listed).
 *
 * @returns {{
 *   rows: Array<Object>,              // db.meshPaints rows, !deletedAt
 *   hostById: Object<string, Object>, // raw db.annotations rows (deleted ones included, check deletedAt)
 *                                     // + meshPaintPointsUpdatedAt (newest updatedAt of their points)
 *   listingById: Object<string, Object>, // raw listings of the painting templates
 *   paintedHostIds: Set<string>,      // hosts of the live rows
 *   loaded: boolean,
 * }}
 */
export default function useMeshPaints() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const data = useLiveQuery(async () => {
    if (!projectId || !db.meshPaints) return null;
    const all = await db.meshPaints
      .where("projectId")
      .equals(projectId)
      .toArray();
    const rows = all.filter((r) => !r.deletedAt);
    const hostIds = [...new Set(rows.map((r) => r.hostAnnotationId))];
    const listingIds = [
      ...new Set(rows.map((r) => r.listingId).filter(Boolean)),
    ];
    const [hosts, listings] = await Promise.all([
      hostIds.length ? db.annotations.bulkGet(hostIds) : [],
      listingIds.length ? db.listings.bulkGet(listingIds) : [],
    ]);
    // A 2D vertex drag writes db.points only: the host's geometry time is
    // the newest of its row and its points (« à vérifier » rule, see
    // getMeshPaintHostTime).
    const pointIdsByHost = new Map();
    const allPointIds = new Set();
    hosts.forEach((h) => {
      if (!h) return;
      const ids = [...collectReferencedPointIds([h])];
      pointIdsByHost.set(h.id, ids);
      ids.forEach((id) => allPointIds.add(id));
    });
    const pointIds = [...allPointIds];
    const points = pointIds.length ? await db.points.bulkGet(pointIds) : [];
    const pointUpdatedAt = new Map();
    points.forEach((p, i) => {
      if (p?.updatedAt) pointUpdatedAt.set(pointIds[i], p.updatedAt);
    });
    const hostById = {};
    hosts.forEach((h) => {
      if (!h) return;
      let newest = null;
      for (const id of pointIdsByHost.get(h.id) ?? []) {
        const t = pointUpdatedAt.get(id);
        if (t && (!newest || t > newest)) newest = t;
      }
      hostById[h.id] = newest ? { ...h, meshPaintPointsUpdatedAt: newest } : h;
    });
    const listingById = {};
    listings.forEach((l) => {
      if (l) listingById[l.id] = l;
    });
    return { rows, hostById, listingById };
  }, [projectId]);

  return useMemo(() => {
    const rows = data?.rows ?? EMPTY_ROWS;
    return {
      rows,
      hostById: data?.hostById ?? EMPTY_OBJECT,
      listingById: data?.listingById ?? EMPTY_OBJECT,
      paintedHostIds: new Set(rows.map((r) => r.hostAnnotationId)),
      loaded: data !== undefined,
    };
  }, [data]);
}

const EMPTY_ROWS = [];
const EMPTY_OBJECT = {};
