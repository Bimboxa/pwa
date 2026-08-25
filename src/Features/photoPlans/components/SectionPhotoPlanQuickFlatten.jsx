import { useDispatch, useSelector } from "react-redux";

import {
  triggerPhotoPlansUpdate,
  setSelectedPhotoPlanIdInMap,
  setShowGuideLinesInMap,
} from "../photoPlansSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import usePhotoPlanZones from "../hooks/usePhotoPlanZones";
import useQuickFlattenTargetPlan from "../hooks/useQuickFlattenTargetPlan";
import useCreatePhotoPlan from "../hooks/useCreatePhotoPlan";
import useFlattenPhotoPlanToBaseMap from "../hooks/useFlattenPhotoPlanToBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import computePhotoPlanQuickCalibration from "../utils/computePhotoPlanQuickCalibration";
import {
  defaultVanishingLines,
  linesEqualDefaults,
  CALIBRATION_ERROR_MESSAGES,
} from "../utils/calibrationUiConstants";

// "Mettre à plat" section of the Transfo. tool (BASE_MAPS module), shown for
// PHOTO baseMaps: quick display-only rectification from the vanishing guide
// lines alone — no pastilles, no scale, no world anchoring (those come later
// through the Élévation calibration / 3D positioning). Works on the photo's
// whole-photo plan (created on demand).
export default function SectionPhotoPlanQuickFlatten({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const { value: allBaseMaps = [] } = useBaseMaps();
  const createPhotoPlan = useCreatePhotoPlan();
  const flattenPhotoPlanToBaseMap = useFlattenPhotoPlanToBaseMap();
  const showGuides = useSelector((s) => s.photoPlans.showGuideLinesInMap);

  // helpers

  // Target = the plan selected in the chips band (a "découpe" zone plan,
  // typically) else the whole-photo plan — the baked image is cropped to
  // the target's zone.
  const targetPlan = useQuickFlattenTargetPlan({ baseMap });
  const imageSize = baseMap?.getImageSize?.();
  // Source-polygon rings, needed when the target is a zone plan.
  const { value: zones = [] } = usePhotoPlanZones({
    baseMapId: targetPlan?.annotationId ? baseMap?.id : null,
    imageSize,
  });
  const orientation = targetPlan?.orientation ?? "VERTICAL";
  const isMetric = Boolean(
    targetPlan?.calibration?.ok && !targetPlan.calibration.isUnscaled
  );
  const hasFlattened = Boolean(
    targetPlan?.flattenedBaseMapId &&
    allBaseMaps.some((b) => b.id === targetPlan.flattenedBaseMapId)
  );

  async function ensureTargetPlan() {
    if (targetPlan) return targetPlan;
    return await createPhotoPlan({
      baseMap,
      name: "Photo entière",
      orientation: "VERTICAL",
    });
  }

  // handlers

  async function handleToggleGuides(checked) {
    if (checked) await ensureTargetPlan();
    dispatch(setShowGuideLinesInMap(checked));
  }

  async function handleOrientationChange(value) {
    if (!value) return;
    const plan = await ensureTargetPlan();
    await db.photoPlans.update(plan.id, { orientation: value });
    dispatch(triggerPhotoPlansUpdate());
  }

  async function handleFlatten() {
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
    dispatch(
      setToaster({
        message:
          "Fond de plan « à plat » créé — vous dessinez maintenant dessus.",
      })
    );
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

    const result = computePhotoPlanQuickCalibration({
      photoImageSize: imageSize,
      planeType: plan.orientation,
      uSegments: lines.u,
      vSegments: lines.v,
    });
    if (!result?.ok) {
      dispatch(
        setToaster({
          message:
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
      },
      calibration: {
        ok: true,
        isUnscaled: true,
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

  // render

  if (!baseMap?.isPhoto) return null;

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        Mettre à plat
      </Typography>
      <Typography variant="caption" sx={{ display: "block", fontWeight: 600 }}>
        {targetPlan?.annotationId
          ? `Zone : ${targetPlan.name}`
          : "Photo entière"}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {hasFlattened
          ? "Fond de plan « à plat » créé — dessinez dessus ; le toggle des propriétés permet de revenir à la photo. Pour le regénérer, supprimez-le d'abord."
          : isMetric
            ? "Photo calibrée (échelle réelle) — crée un fond de plan redressé, à l'échelle et positionné en 3D, sur lequel dessiner."
            : "Crée un fond de plan redressé à partir des lignes guides (proportions exactes ; échelle et position à définir ensuite)."}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showGuides}
              onChange={(e) => handleToggleGuides(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">Afficher les lignes guides</Typography>
          }
        />

        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={orientation}
          onChange={(_e, v) => handleOrientationChange(v)}
        >
          <ToggleButton
            value="VERTICAL"
            sx={{ textTransform: "none", py: 0.25 }}
          >
            Vertical
          </ToggleButton>
          <ToggleButton
            value="HORIZONTAL"
            sx={{ textTransform: "none", py: 0.25 }}
          >
            Horizontal
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant="contained"
          size="small"
          startIcon={<FlipToFrontIcon />}
          onClick={handleFlatten}
          sx={{ textTransform: "none" }}
        >
          {hasFlattened ? "Ouvrir la mise à plat" : "Mettre à plat"}
        </Button>
      </Box>
    </WhiteSectionGeneric>
  );
}
