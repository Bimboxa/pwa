import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setFlattenedPhotoPlanId } from "../photoPlansSlice";

import { Box, CircularProgress, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import usePhotoPlanZones from "../hooks/usePhotoPlanZones";
import bakePhotoPlanOrtho from "../utils/bakePhotoPlanOrtho";

// Read-only rectified preview ("mise à plat") of the selected photoPlan:
// covers the map editor with the baked orthophoto of the zone (true metric
// proportions). Nothing is persisted — close (or toggle the chips button) to
// get the photo back.
export default function PhotoPlanFlattenedOverlay({ baseMap }) {
  const dispatch = useDispatch();

  const flattenedId = useSelector((s) => s.photoPlans.flattenedPhotoPlanId);

  const imageSize = baseMap?.getImageSize?.();
  const imageUrl = baseMap?.getUrl?.();

  const { value: zones } = usePhotoPlanZones({
    baseMapId: baseMap?.isPhoto && flattenedId ? baseMap.id : null,
    imageSize,
  });

  const zone = useMemo(
    () => zones.find((z) => z.plan.id === flattenedId) ?? null,
    [zones, flattenedId]
  );

  const [baked, setBaked] = useState(null); // {planId, result} | null
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!zone || !zone.plan.calibration?.ok || !imageUrl) {
      setBaked(null);
      return;
    }
    if (baked?.planId === zone.plan.id) return;
    let cancelled = false;
    bakePhotoPlanOrtho({
      imageUrl,
      imageSize,
      calibration: zone.plan.calibration,
      ringPx: zone.ringPx,
      holesPx: zone.holesPx,
    })
      .then((result) => {
        if (cancelled) return;
        if (result) setBaked({ planId: zone.plan.id, result });
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [zone?.plan?.id, zone?.plan?.calibration?.computedAt, imageUrl]);

  if (!baseMap?.isPhoto || !flattenedId) return null;

  const result = baked?.planId === flattenedId ? baked.result : null;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          // Keep clear of the centered chips band (zIndex 30).
          pt: 6,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {zone?.plan?.name ?? "Plan photo"} — mise à plat
        </Typography>
        {result &&
          (zone?.plan?.calibration?.isUnscaled ? (
            <Typography variant="caption" color="text.secondary">
              {
                "Proportions exactes — échelle non définie (calibrez depuis l'outil Élévation pour mesurer). Lecture seule."
              }
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {result.widthM.toFixed(2)} × {result.heightM.toFixed(2)}
              {" m — aperçu à l'échelle, lecture seule"}
            </Typography>
          ))}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          size="small"
          onClick={() => dispatch(setFlattenedPhotoPlanId(null))}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Rectified image */}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        {result ? (
          <Box
            component="img"
            src={result.dataUrl}
            alt=""
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              boxShadow: 3,
              bgcolor: "white",
            }}
          />
        ) : failed ? (
          <Typography variant="body2" color="text.secondary">
            {
              "Mise à plat impossible (zone sur l'horizon ou image indisponible)."
            }
          </Typography>
        ) : (
          <CircularProgress size={28} />
        )}
      </Box>
    </Box>
  );
}
