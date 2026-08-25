import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedPhotoPlanIdInMap,
  setFlattenedPhotoPlanId,
} from "../photoPlansSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Box, Button, Chip, Tooltip, Typography } from "@mui/material";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";

import usePhotoPlans from "../hooks/usePhotoPlans";

// Chips band over the map editor when the displayed baseMap is a PHOTO:
// select a photoPlan to highlight its zone (mask layer blurs the rest), and
// "Mettre à plat" toggles the read-only rectified preview overlay.
export default function TopPhotoPlanChips({ baseMap }) {
  const dispatch = useDispatch();

  const selectedId = useSelector((s) => s.photoPlans.selectedPhotoPlanIdInMap);
  const flattenedId = useSelector((s) => s.photoPlans.flattenedPhotoPlanId);
  const { value: photoPlans = [] } = usePhotoPlans({
    baseMapId: baseMap?.isPhoto ? baseMap.id : null,
  });

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

  function handleToggleFlatten() {
    // A baked flattened baseMap exists: switch the editor to it (real
    // drawing surface) instead of the read-only overlay.
    if (selectedPlan?.flattenedBaseMapId) {
      dispatch(setSelectedMainBaseMapId(selectedPlan.flattenedBaseMapId));
      return;
    }
    dispatch(
      setFlattenedPhotoPlanId(flattenedId === selectedId ? null : selectedId)
    );
  }

  // render

  if (!baseMap?.isPhoto || photoPlans.length === 0) return null;

  const calibrated = Boolean(selectedPlan?.calibration?.ok);

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
            calibrated
              ? flattenedId === selectedId
                ? "Revenir à la photo"
                : "Aperçu redressé à l'échelle (lecture seule)"
              : "Calibrez d'abord ce plan (outil Élévation du module Fonds de plan)"
          }
        >
          <span>
            <Button
              size="small"
              variant={flattenedId === selectedId ? "contained" : "outlined"}
              startIcon={<FlipToFrontIcon />}
              disabled={!calibrated}
              onClick={handleToggleFlatten}
              sx={{ textTransform: "none", ml: 0.5, borderRadius: 4 }}
            >
              {flattenedId === selectedId ? "Photo" : "Mettre à plat"}
            </Button>
          </span>
        </Tooltip>
      )}
    </Box>
  );
}
