import { useDispatch, useSelector } from "react-redux";

import {
  triggerPhotoPlansUpdate,
  setSelectedPhotoPlanIdInMap,
  setFlattenedPhotoPlanId,
  setShowGuideLinesInMap,
} from "../photoPlansSlice";
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
  const createPhotoPlan = useCreatePhotoPlan();
  const showGuides = useSelector((s) => s.photoPlans.showGuideLinesInMap);

  // helpers

  const fullPlan = photoPlans.find((p) => !p.annotationId) ?? null;
  const orientation = fullPlan?.orientation ?? "VERTICAL";
  const isMetric = Boolean(
    fullPlan?.calibration?.ok && !fullPlan.calibration.isUnscaled
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
    const plan = await ensureFullPlan();
    dispatch(setSelectedPhotoPlanIdInMap(plan.id));

    // A metric calibration (Élévation flow) wins — just open the preview.
    if (plan.calibration?.ok && !plan.calibration.isUnscaled) {
      dispatch(setFlattenedPhotoPlanId(plan.id));
      return;
    }

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
      return;
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
      return;
    }

    await db.photoPlans.update(plan.id, {
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
    });
    dispatch(triggerPhotoPlansUpdate());
    dispatch(setFlattenedPhotoPlanId(plan.id));
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
        {isMetric
          ? "Photo calibrée (échelle réelle) — la mise à plat utilise cette calibration."
          : "Redresse la photo à partir des lignes guides (proportions exactes, échelle et position à définir ensuite)."}
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
          Mettre à plat
        </Button>
      </Box>
    </WhiteSectionGeneric>
  );
}
