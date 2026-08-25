import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedPhotoPlanIdInMap } from "../photoPlansSlice";

import { Box, Button, Chip, Tooltip, Typography } from "@mui/material";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";

import usePhotoPlans from "../hooks/usePhotoPlans";
import useQuickFlattenAction from "../hooks/useQuickFlattenAction";

// Chips band over the map editor when the displayed baseMap is a PHOTO:
// select a photoPlan to highlight its zone (mask layer blurs the rest), and
// "Mettre à plat" runs the SAME quick-flatten action as the Transfo. tool —
// bake the plan's crop zone into a real baseMap (self-calibrating from the
// guide lines when needed) or switch to it when it already exists.
export default function TopPhotoPlanChips({ baseMap }) {
  const dispatch = useDispatch();

  const selectedId = useSelector((s) => s.photoPlans.selectedPhotoPlanIdInMap);
  const { value: photoPlans = [] } = usePhotoPlans({
    baseMapId: baseMap?.isPhoto ? baseMap.id : null,
  });
  const { hasFlattened, flatten } = useQuickFlattenAction({ baseMap });

  const selectedPlan = photoPlans.find((p) => p.id === selectedId) ?? null;

  // Clear a selection that no longer belongs to the displayed photo.
  useEffect(() => {
    if (selectedId && photoPlans.length > 0 && !selectedPlan) {
      dispatch(setSelectedPhotoPlanIdInMap(null));
    }
  }, [selectedId, selectedPlan, photoPlans.length, dispatch]);

  // handlers

  function handleChipClick(planId) {
    dispatch(
      setSelectedPhotoPlanIdInMap(planId === selectedId ? null : planId)
    );
  }

  // render

  if (!baseMap?.isPhoto || photoPlans.length === 0) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 5,
        bgcolor: "background.paper",
        boxShadow: 2,
        maxWidth: "70%",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
        Plans photo
      </Typography>
      {photoPlans.map((p) => {
        const sel = p.id === selectedId;
        return (
          <Chip
            key={p.id}
            size="small"
            label={`${p.name}${
              p.calibration?.ok ? (p.calibration.isUnscaled ? " ≈" : " ✓") : ""
            }`}
            color={sel ? "primary" : "default"}
            variant={sel ? "filled" : "outlined"}
            onClick={() => handleChipClick(p.id)}
          />
        );
      })}
      {selectedPlan && (
        <Tooltip
          title={
            hasFlattened
              ? "Ouvrir le fond de plan redressé"
              : "Crée le fond de plan redressé de la zone (calibration rapide via les lignes guides si besoin)"
          }
        >
          <Button
            size="small"
            variant={hasFlattened ? "contained" : "outlined"}
            startIcon={<FlipToFrontIcon />}
            onClick={flatten}
            sx={{ textTransform: "none", ml: 0.5, borderRadius: 4 }}
          >
            {hasFlattened ? "Ouvrir la mise à plat" : "Mettre à plat"}
          </Button>
        </Tooltip>
      )}
    </Box>
  );
}
