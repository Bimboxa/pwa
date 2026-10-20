import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  triggerPhotoPlansUpdate,
  setSelectedPhotoPlanIdInMap,
  setShowGuideLinesInMap,
} from "../photoPlansSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import usePhotoPlanZones from "./usePhotoPlanZones";
import useQuickFlattenTargetPlan from "./useQuickFlattenTargetPlan";
import useCreatePhotoPlan from "./useCreatePhotoPlan";
import useFlattenPhotoPlanToBaseMap from "./useFlattenPhotoPlanToBaseMap";
import computePhotoPlanQuickCalibration from "../utils/computePhotoPlanQuickCalibration";
import { getPhotoBaseMapExifFocal35 } from "../utils/readExifFocal35";
import { DEFAULT_FOCAL_35, focal35ToPx } from "../utils/focal35";
import {
  defaultVanishingLines,
  linesEqualDefaults,
  CALIBRATION_ERROR_MESSAGES,
} from "../utils/calibrationUiConstants";

// Whole-photo rings get clipped farther from the plane's horizon than drawn
// zones: the depth stretch of the farthest kept pixels is ~ (1 / eps)², so
// 0.2 caps it at ~25x the nearest corner — past that the strip is a smear
// that would only inflate the output's extent (and shrink its resolution).
const WHOLE_PHOTO_HORIZON_EPS = 0.2;

// Quick-flow wording of errors raised on the synthesized anchors (the two
// endpoints of the first U guide line — there are no pastilles here).
const QUICK_ERROR_MESSAGES = {
  TARGET_ON_HORIZON:
    "Une extrémité de ligne guide bleue est sur l'horizon du plan — rapprochez-la.",
  PHOTO_TARGETS_SUPERIMPOSED:
    "Les deux extrémités de la 1ʳᵉ ligne guide bleue sont confondues — écartez-les.",
  TARGETS_SAME_U:
    "La 1ʳᵉ ligne guide bleue doit suivre une ligne horizontale du plan.",
};

// The complete "Mettre à plat" action, shared by the Transfo. section and
// the map-editor chips band so both buttons behave identically:
//   target plan (chips-selected zone else whole-photo, created on demand)
//   -> reuse its metric calibration, else quick-calibrate from the guide
//      lines (blocking with a toaster when they were never adjusted)
//   -> bake the plan's crop zone into a real baseMap and switch to it
//   -> or just switch when the flattened baseMap already exists.
export default function useQuickFlattenAction({ baseMap }) {
  const dispatch = useDispatch();

  const { value: allBaseMaps = [] } = useBaseMaps();
  const showGuides = useSelector((s) => s.photoPlans.showGuideLinesInMap);
  const targetPlan = useQuickFlattenTargetPlan({ baseMap });
  const createPhotoPlan = useCreatePhotoPlan();
  const flattenPhotoPlanToBaseMap = useFlattenPhotoPlanToBaseMap();

  const imageSize = baseMap?.getImageSize?.();
  const { value: zones = [] } = usePhotoPlanZones({
    baseMapId: targetPlan?.annotationId ? baseMap?.id : null,
    imageSize,
  });

  const hasFlattened = Boolean(
    targetPlan?.flattenedBaseMapId &&
    allBaseMaps.some((b) => b.id === targetPlan.flattenedBaseMapId)
  );
  const isMetric = Boolean(
    targetPlan?.calibration?.ok && !targetPlan.calibration.isUnscaled
  );

  // EXIF focal (35 mm equiv.) of the photo, read once per plan and cached on
  // its calibrationInputs (null = read, none found).
  useEffect(() => {
    if (!targetPlan || !baseMap?.isPhoto) return;
    if (targetPlan.calibrationInputs?.exifFocal35 !== undefined) return;
    let cancelled = false;
    (async () => {
      const exifFocal35 = (await getPhotoBaseMapExifFocal35(baseMap)) ?? null;
      if (cancelled) return;
      const fresh = await db.photoPlans.get(targetPlan.id);
      if (!fresh || fresh.calibrationInputs?.exifFocal35 !== undefined) return;
      await db.photoPlans.update(targetPlan.id, {
        calibrationInputs: { ...(fresh.calibrationInputs ?? {}), exifFocal35 },
      });
      dispatch(triggerPhotoPlansUpdate());
    })();
    return () => {
      cancelled = true;
    };
  }, [targetPlan?.id, targetPlan?.calibrationInputs?.exifFocal35, baseMap?.id]);

  async function ensureTargetPlan() {
    if (targetPlan) return targetPlan;
    return await createPhotoPlan({
      baseMap,
      name: "Photo entière",
      orientation: "VERTICAL",
    });
  }

  // Computes + persists the unscaled quick calibration; returns the updated
  // plan record or null (with a toaster explaining why).
  async function computeAndPersistQuickCalibration(plan) {
    const lines = {
      u: plan.calibrationInputs?.uSegments ?? defaultVanishingLines().u,
      v: plan.calibrationInputs?.vSegments ?? defaultVanishingLines().v,
    };
    if (linesEqualDefaults(lines)) {
      dispatch(setShowGuideLinesInMap(true));
      dispatch(
        setToaster({
          message:
            "Ajustez d'abord les lignes guides (bleues = 1ʳᵉ direction, oranges = 2ᵉ) sur des lignes réelles de la photo.",
          isError: true,
        })
      );
      return null;
    }

    // Focal: the user's field, else the photo's EXIF (read lazily when the
    // effect above has not landed yet), else the 26 mm default inside the
    // quick calibration.
    let focalPxOverride = plan.calibrationInputs?.focalPxOverride;
    let exifFocal35 = plan.calibrationInputs?.exifFocal35;
    if (!(Number.isFinite(focalPxOverride) && focalPxOverride > 0)) {
      focalPxOverride = null;
      if (exifFocal35 === undefined) {
        exifFocal35 = (await getPhotoBaseMapExifFocal35(baseMap)) ?? null;
      }
      if (exifFocal35) focalPxOverride = focal35ToPx(exifFocal35, imageSize);
    }

    const result = computePhotoPlanQuickCalibration({
      photoImageSize: imageSize,
      planeType: plan.orientation,
      uSegments: lines.u,
      vSegments: lines.v,
      focalPxOverride,
      mirrored: Boolean(plan.mirrored),
    });
    if (!result?.ok) {
      dispatch(
        setToaster({
          message:
            QUICK_ERROR_MESSAGES[result?.errorCode] ??
            CALIBRATION_ERROR_MESSAGES[result?.errorCode] ??
            `Mise à plat impossible (${result?.errorCode ?? "?"}).`,
          isError: true,
        })
      );
      return null;
    }

    const patch = {
      calibrationInputs: {
        ...(plan.calibrationInputs ?? {}),
        uSegments: lines.u,
        vSegments: lines.v,
        exifFocal35: exifFocal35 ?? null,
      },
      calibration: {
        ok: true,
        isUnscaled: true,
        mirrored: result.mirrored,
        H: result.H,
        Hinv: result.Hinv,
        pose: result.pose,
        imageSize: result.imageSize,
        horizonLine: result.horizonLine,
        diagnostics: result.diagnostics,
        computedAt: new Date().toISOString(),
      },
    };
    await db.photoPlans.update(plan.id, patch);
    dispatch(triggerPhotoPlansUpdate());
    return { ...plan, ...patch };
  }

  async function flatten() {
    let plan = await ensureTargetPlan();
    dispatch(setSelectedPhotoPlanIdInMap(plan.id));

    // Already baked into a real baseMap: just switch to it. (Re-bake path:
    // delete the flattened baseMap from the list, then flatten again.)
    if (
      plan.flattenedBaseMapId &&
      allBaseMaps.some((b) => b.id === plan.flattenedBaseMapId)
    ) {
      dispatch(setSelectedMainBaseMapId(plan.flattenedBaseMapId));
      return;
    }

    // No usable calibration yet: compute the display-only rectification
    // from the guide lines (a metric calibration from the Élévation flow
    // wins and is used as-is).
    if (!plan.calibration?.ok || plan.calibration.isUnscaled) {
      const computed = await computeAndPersistQuickCalibration(plan);
      if (!computed) return;
      plan = computed;
    }

    // Bake ring = the plan's "découpe" zone (source polygon) — or the
    // whole image for the whole-photo plan.
    let ringPx;
    let holesPx = [];
    if (plan.annotationId) {
      const zone = zones.find((z) => z.plan.id === plan.id);
      if (!zone) {
        dispatch(
          setToaster({
            message: "Zone du plan photo introuvable — réessayez.",
            isError: true,
          })
        );
        return;
      }
      ringPx = zone.ringPx;
      holesPx = zone.holesPx;
    } else {
      ringPx = [
        { x: 0, y: 0 },
        { x: imageSize.width, y: 0 },
        { x: imageSize.width, y: imageSize.height },
        { x: 0, y: imageSize.height },
      ];
    }
    const newId = await flattenPhotoPlanToBaseMap({
      photoBaseMap: baseMap,
      plan,
      ringPx,
      holesPx,
      horizonEpsFraction: plan.annotationId
        ? undefined
        : WHOLE_PHOTO_HORIZON_EPS,
    });
    if (!newId) {
      dispatch(
        setToaster({
          message: "Mise à plat impossible (zone sur l'horizon ?).",
          isError: true,
        })
      );
      return;
    }
    const diag = plan.calibration?.diagnostics;
    const focalNote = plan.calibration?.isUnscaled
      ? diag?.warnings?.includes("DEFAULT_FOCAL")
        ? ` (focale par défaut ${DEFAULT_FOCAL_35} mm)`
        : Number.isFinite(diag?.focal35)
          ? ` (focale ${Math.round(diag.focal35)} mm${
              diag.focalSource === "override" ? "" : " estimée"
            })`
          : ""
      : "";
    dispatch(
      setToaster({
        message: `Fond de plan « à plat » créé — vous dessinez maintenant dessus.${focalNote}`,
      })
    );
  }

  return {
    targetPlan,
    hasFlattened,
    isMetric,
    showGuides,
    ensureTargetPlan,
    flatten,
  };
}
