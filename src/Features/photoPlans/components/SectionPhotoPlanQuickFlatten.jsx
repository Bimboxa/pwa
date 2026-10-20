import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import {
  triggerPhotoPlansUpdate,
  setShowGuideLinesInMap,
} from "../photoPlansSlice";

import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useQuickFlattenAction from "../hooks/useQuickFlattenAction";
import { DEFAULT_FOCAL_35, focal35ToPx, pxToFocal35 } from "../utils/focal35";

// "Mettre à plat" section of the Transfo. tool (BASE_MAPS module), shown for
// PHOTO baseMaps: guide-lines switch, plane orientation, and the shared
// quick-flatten action (useQuickFlattenAction — same behavior as the
// map-editor chips button). Targets the chips-selected plan (a "découpe"
// zone) else the whole-photo plan.
export default function SectionPhotoPlanQuickFlatten({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const {
    targetPlan,
    hasFlattened,
    isMetric,
    showGuides,
    ensureTargetPlan,
    flatten,
  } = useQuickFlattenAction({ baseMap });

  // state

  // Focal field (35 mm equiv.) — persisted on blur as calibrationInputs
  // .focalPxOverride (same storage the Élévation panel seeds from).
  const [focalStr, setFocalStr] = useState("");

  // helpers

  const orientation = targetPlan?.orientation ?? "VERTICAL";
  const mirrored = Boolean(targetPlan?.mirrored);
  const imageSize = baseMap?.getImageSize?.();
  const exifFocal35 = targetPlan?.calibrationInputs?.exifFocal35 ?? null;
  const storedFocal35 = pxToFocal35(
    targetPlan?.calibrationInputs?.focalPxOverride,
    imageSize
  );

  useEffect(() => {
    setFocalStr(
      storedFocal35 != null ? String(Math.round(storedFocal35 * 10) / 10) : ""
    );
  }, [targetPlan?.id, storedFocal35]);

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

  async function handleMirroredChange(checked) {
    const plan = await ensureTargetPlan();
    await db.photoPlans.update(plan.id, { mirrored: checked });
    dispatch(triggerPhotoPlansUpdate());
  }

  async function handleFocalBlur() {
    const plan = await ensureTargetPlan();
    const focal35 = focalStr
      ? parseFloat(String(focalStr).replace(",", "."))
      : null;
    const focalPxOverride = focal35ToPx(focal35, imageSize);
    const current = plan.calibrationInputs?.focalPxOverride ?? null;
    if ((focalPxOverride ?? null) === current) return;
    const { focalPxOverride: _dropped, ...rest } = plan.calibrationInputs ?? {};
    void _dropped;
    await db.photoPlans.update(plan.id, {
      calibrationInputs: {
        ...rest,
        ...(focalPxOverride != null && { focalPxOverride }),
      },
    });
    dispatch(triggerPhotoPlansUpdate());
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

        <TextField
          size="small"
          label="Focale (équiv. 35 mm)"
          placeholder={
            exifFocal35 ? `${exifFocal35} (EXIF)` : `${DEFAULT_FOCAL_35}`
          }
          helperText={
            exifFocal35
              ? "Lue dans la photo (EXIF) — modifiez-la si besoin."
              : `Pas d'EXIF : ${DEFAULT_FOCAL_35} mm par défaut quand les lignes ne permettent pas de la calculer.`
          }
          value={focalStr}
          onChange={(e) => setFocalStr(e.target.value)}
          onBlur={handleFocalBlur}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Button
          variant="contained"
          size="small"
          startIcon={<FlipToFrontIcon />}
          onClick={flatten}
          sx={{ textTransform: "none" }}
        >
          {hasFlattened ? "Ouvrir la mise à plat" : "Mettre à plat"}
        </Button>

        {orientation === "HORIZONTAL" && (
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={mirrored}
                  onChange={(e) => handleMirroredChange(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Plan réfléchi</Typography>}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block" }}
            >
              {
                "Image en miroir : sous-face / plafond vu de dessus, superposable au plan d'étage. Décoché, l'image garde le sens de la photo."
              }
            </Typography>
          </Box>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
