import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import resolvePoints from "Features/annotations/utils/resolvePoints";
import mapPhotoPointsToPlane from "Features/photoPlans/utils/mapPhotoPointsToPlane";

// Feeds PhotoPlansManager with the CALIBRATED photoPlans of the project's
// photo baseMaps: each item carries the source polygon mapped into the
// plane's metric frame (geometry / mask), the world pose, the inverse
// homography (fragment-shader texture mapping) and the photo image url.
export default function useAutoLoadPhotoPlansInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const photoPlansUpdatedAt = useSelector(
    (s) => s.photoPlans.photoPlansUpdatedAt
  );
  const { value: baseMaps = [] } = useBaseMaps();

  const photoBaseMaps = baseMaps.filter((b) => b?.isPhoto);
  const photoBaseMapsKey = photoBaseMaps
    .map((b) => `${b.id}:${b.getUrl?.() ?? ""}`)
    .join(",");

  const items = useLiveQuery(async () => {
    if (photoBaseMaps.length === 0) return [];
    const byId = {};
    for (const bm of photoBaseMaps) byId[bm.id] = bm;

    const plans = (
      await db.photoPlans
        .where("baseMapId")
        .anyOf(Object.keys(byId))
        .toArray()
    ).filter((p) => !p.deletedAt && p.calibration?.ok);

    const out = [];
    for (const plan of plans) {
      const bm = byId[plan.baseMapId];
      const imageSize = bm?.getImageSize?.() || bm?.image?.imageSize;
      const imageUrl = bm?.getUrl?.();
      if (!imageSize?.width || !imageSize?.height || !imageUrl) continue;

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

      const ringPx = resolvePoints({
        points: srcAnn.points,
        pointsIndex: idx,
        imageSize,
      });
      if (!ringPx || ringPx.length < 3) continue;
      const ringLocal = mapPhotoPointsToPlane({
        H: plan.calibration.H,
        points: ringPx,
        imageSize,
        closeLine: true,
      });
      if (!ringLocal) continue; // source crosses the horizon — skip

      const holesLocal = [];
      for (const cut of srcAnn.cuts ?? []) {
        const holePx = resolvePoints({
          points: cut?.points ?? [],
          pointsIndex: idx,
          imageSize,
        });
        if (!holePx || holePx.length < 3) continue;
        const holeLocal = mapPhotoPointsToPlane({
          H: plan.calibration.H,
          points: holePx,
          imageSize,
          closeLine: true,
        });
        if (holeLocal) holesLocal.push(holeLocal);
      }

      // Signature: pose + geometry extent + recalibration stamp. Point moves
      // bypass annotation.updatedAt (db.points writes), hence the coarse
      // coordinate hash.
      const coordHash = ringLocal
        .reduce((s, p) => s + p.x + p.y, 0)
        .toFixed(4);
      const { origin, uDir } = plan.calibration.pose;
      const signature = [
        plan.id,
        plan.calibration.computedAt ?? "",
        ringLocal.length,
        coordHash,
        origin.x,
        origin.y,
        origin.z,
        uDir.x,
        uDir.z,
        imageUrl,
      ].join(":");

      out.push({
        id: plan.id,
        signature,
        pose: plan.calibration.pose,
        Hinv: plan.calibration.Hinv,
        imageUrl,
        ringLocal,
        holesLocal,
      });
    }
    return out;
  }, [photoBaseMapsKey, photoPlansUpdatedAt]);

  useEffect(() => {
    const manager = threedEditor?.sceneManager?.photoPlansManager;
    if (!manager || !rendererIsReady || items === undefined) return;
    manager.setPhotoPlans(items);
  }, [threedEditor, rendererIsReady, items]);
}
