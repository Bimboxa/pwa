import { useDispatch } from "react-redux";

import { triggerPhotoPlansUpdate } from "../photoPlansSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

import db from "App/db/db";

import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import bakePhotoPlanOrtho from "../utils/bakePhotoPlanOrtho";

// Bake a calibrated photoPlan into a REAL baseMap ("mise à plat"): the
// rectified orthophoto becomes a standard fond de plan the user draws on —
// annotations live in ITS affine frame (all the drawing aids, quantities and
// the 3D placement work natively). Metric calibrations carry meterByPx +
// the 3D placement (orientation / angleDeg / position from the plan's
// pose); unscaled ones are scaled/positioned later with the standard tools.
//
// Links written:
//   flattened baseMap.sourcePhotoBaseMapId -> the photo
//   photo baseMap.flattenedBaseMapId      -> the flattened one (whole-photo
//     plan only: this is what hides the photo in the baseMaps lists)
//   photoPlan.flattenedBaseMapId + flattenedFrame (bake-time H/Hinv + frame
//     SNAPSHOT — reprojection must never read the live calibration, which a
//     later re-Positionner can change without re-baking the image).
export default function useFlattenPhotoPlanToBaseMap() {
  const dispatch = useDispatch();
  const createBaseMapFromImage = useCreateBaseMapFromImage();
  const projectBaseMapListings = useProjectBaseMapListings();

  return async function flattenPhotoPlanToBaseMap({
    photoBaseMap,
    plan,
    ringPx,
    holesPx = [],
  }) {
    const calibration = plan?.calibration;
    if (!calibration?.ok || !photoBaseMap) return null;

    const imageSize = photoBaseMap.getImageSize?.();
    const imageUrl = photoBaseMap.getUrl?.();
    const baked = await bakePhotoPlanOrtho({
      imageUrl,
      imageSize,
      calibration,
      ringPx,
      holesPx,
    });
    if (!baked) return null;

    const blob = await (await fetch(baked.dataUrl)).blob();
    const file = new File([blob], `${plan.name || "mise-a-plat"}.png`, {
      type: "image/png",
    });

    const isMetric = !calibration.isUnscaled;
    const listing =
      projectBaseMapListings?.find((l) => l.id === photoBaseMap.listingId) ??
      undefined;

    const created = await createBaseMapFromImage({
      file,
      // Zone plans keep their own name; the whole-photo plan inherits the
      // photo's.
      name: plan.annotationId
        ? `${plan.name || "Plan photo"} — à plat`
        : `${photoBaseMap.name || "Photo"} — à plat`,
      listing,
      ...(isMetric && { meterByPx: 1 / baked.pxPerM }),
      orientation: plan.orientation,
      source: "photoPlanFlatten",
    });
    if (!created?.id) return null;

    // Metric plans: place the flattened plane in 3D from the plan's pose.
    // The baseMap local frame must map local +X -> uDir and local +Y -> vDir:
    // with phi = atan2(uDir.z, uDir.x), BOTH orientations solve to
    // angle a = -phi (VERTICAL euler: X -> (cos a, 0, -sin a) = uDir;
    // HORIZONTAL lay-flat additionally sends Y -> (-sin a, 0, -cos a),
    // which equals the pose's vDir = (sin phi, 0, -cos phi) at a = -phi).
    let placement = {};
    if (isMetric && calibration.pose) {
      const { origin, uDir, vDir } = calibration.pose;
      const phi = Math.atan2(uDir.z, uDir.x);
      const angleRad = -phi;
      // Center of the flattened image in plane coords -> world.
      const uc = baked.uMin + baked.widthPx / 2 / baked.pxPerM;
      const vc = baked.vMax - baked.heightPx / 2 / baked.pxPerM;
      placement = {
        angleDeg: (angleRad * 180) / Math.PI,
        position: {
          x: origin.x + uc * uDir.x + vc * vDir.x,
          y: origin.y + uc * uDir.y + vc * vDir.y,
          z: origin.z + uc * uDir.z + vc * vDir.z,
        },
      };
    }

    await db.baseMaps.update(created.id, {
      sourcePhotoBaseMapId: photoBaseMap.id,
      ...placement,
    });
    if (!plan.annotationId) {
      // Whole-photo plan: the flattened baseMap REPLACES the photo in the
      // lists (props toggle switches between the two).
      await db.baseMaps.update(photoBaseMap.id, {
        flattenedBaseMapId: created.id,
      });
    }
    await db.photoPlans.update(plan.id, {
      flattenedBaseMapId: created.id,
      flattenedFrame: {
        uMin: baked.uMin,
        vMax: baked.vMax,
        pxPerM: baked.pxPerM,
        widthPx: baked.widthPx,
        heightPx: baked.heightPx,
        H: calibration.H,
        Hinv: calibration.Hinv,
      },
    });

    dispatch(triggerBaseMapsUpdate());
    dispatch(triggerPhotoPlansUpdate());
    return created.id;
  };
}
