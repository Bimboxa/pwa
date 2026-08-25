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

import usePhotoPlans from "../hooks/usePhotoPlans";
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

  const { value: photoPlans = [] } = usePhotoPlans({ baseMapId: baseMap?.id });
  const { value: allBaseMaps = [] } = useBaseMaps();
  const createPhotoPlan = useCreatePhotoPlan();
  const flattenPhotoPlanToBaseMap = useFlattenPhotoPlanToBaseMap();
  const showGuides = useSelector((s) => s.photoPlans.showGuideLinesInMap);

  // helpers

  const fullPlan = photoPlans.find((p) => !p.annotationId) ?? null;
  const orientation = fullPlan?.orientation ?? "VERTICAL";
  const isMetric = Boolean(
    fullPlan?.calibration?.ok && !fullPlan.calibration.isUnscaled
  );
  const hasFlattened = Boolean(
    fullPlan?.flattenedBaseMapId &&
    allBaseMaps.some((b) => b.id === fullPlan.flattenedBaseMapId)
  );

  async function ensureFullPlan() {
    if (fullPlan) return fullPlan;
    return await createPhotoPlan({
      baseMap,
      name: "Photo entière",
      orientation: "VERTICAL",
    });
  }

  // handlers

  async function handleToggleGuides(checked) {
    if (checked) await ensureFullPlan();
    dispatch(setShowGuideLinesInMap(checked));
  }

  async function handleOrientationChange(value) {
    if (!value) return;
    const plan = await ensureFullPlan();
    await db.photoPlans.update(plan.id, { orientation: value });
    dispatch(triggerPhotoPlansUpdate());
  }

  async function handleFlatten() {
    let plan = await ensureFullPlan();
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

    const imageSize0 = baseMap?.getImageSize?.();
    const newId = await flattenPhotoPlanToBaseMap({
      photoBaseMap: baseMap,
      plan,
      ringPx: [
        { x: 0, y: 0 },
        { x: imageSize0.width, y: 0 },
        { x: imageSize0.width, y: imageSize0.height },
        { x: 0, y: imageSize0.height },
      ],
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

    const imageSize = baseMap?.getImageSize?.();
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
