import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// The photoPlans of a photo baseMap with their SOURCE polygon resolved to
// pixel space, arcs tessellated: [{ plan, ringPx, holesPx }]. Shared by the
// map-editor mask layer, the chips band and the flatten overlay (direct db
// reads — the source polygons live in isForBaseMaps listings, invisible to
// the MAP module's annotation feed).

const ARC_SAMPLES = 12;
export default function usePhotoPlanZones({ baseMapId, imageSize } = {}) {
  const photoPlansUpdatedAt = useSelector(
    (s) => s.photoPlans.photoPlansUpdatedAt
  );

  const zones = useLiveQuery(async () => {
    if (!baseMapId || !imageSize?.width || !imageSize?.height) return [];

    const plans = (
      await db.photoPlans.where("baseMapId").equals(baseMapId).toArray()
    ).filter((p) => !p.deletedAt);

    const out = [];
    for (const plan of plans) {
      // Whole-photo plan (no source polygon): the zone is the full image.
      if (!plan.annotationId) {
        const { width: W, height: H } = imageSize;
        out.push({
          plan,
          ringPx: [
            { x: 0, y: 0 },
            { x: W, y: 0 },
            { x: W, y: H },
            { x: 0, y: H },
          ],
          holesPx: [],
        });
        continue;
      }
      const srcAnn = await db.annotations.get(plan.annotationId);
      if (!srcAnn || srcAnn.deletedAt) continue;
      const ids = new Set();
      (srcAnn.points ?? []).forEach((p) => p?.id && ids.add(p.id));
      (srcAnn.cuts ?? []).forEach((c) =>
        (c?.points ?? []).forEach((p) => p?.id && ids.add(p.id))
      );
      const arr = await db.points.bulkGet([...ids]);
      const idx = {};
      for (const p of arr) if (p) idx[p.id] = p;

      const ringRaw = resolvePoints({
        points: srcAnn.points,
        pointsIndex: idx,
        imageSize,
      });
      if (!ringRaw || ringRaw.length < 3) continue;
      const ringPx = expandArcsInPath(ringRaw, ARC_SAMPLES, true);
      const holesPx = (srcAnn.cuts ?? [])
        .map((c) =>
          resolvePoints({ points: c.points ?? [], pointsIndex: idx, imageSize })
        )
        .filter((h) => h?.length >= 3)
        .map((h) => expandArcsInPath(h, ARC_SAMPLES, true));
      out.push({ plan, ringPx, holesPx });
    }
    return out;
  }, [baseMapId, imageSize?.width, imageSize?.height, photoPlansUpdatedAt]);

  return { value: zones ?? [], loading: zones === undefined };
}
