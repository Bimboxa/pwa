import { useDispatch } from "react-redux";

import {
  triggerPhotoPlansUpdate,
  setShowGuideLinesInMap,
} from "../photoPlansSlice";

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

import useQuickFlattenAction from "../hooks/useQuickFlattenAction";

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

  // helpers

  const orientation = targetPlan?.orientation ?? "VERTICAL";

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
          onClick={flatten}
          sx={{ textTransform: "none" }}
        >
          {hasFlattened ? "Ouvrir la mise à plat" : "Mettre à plat"}
        </Button>
      </Box>
    </WhiteSectionGeneric>
  );
}
