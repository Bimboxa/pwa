import { Box, LinearProgress, Typography } from "@mui/material";

import useScene3dPickingStatus from "../hooks/useScene3dPickingStatus";

// Status line of the scan picking data, shown in the drawing helper while a
// 3D tool can draw on a SCENE_3D scan: progress of the preparation, then
// "ready". Renders nothing when no scan is involved.
export default function SectionScene3dPickingStatus() {
  // strings

  const loadingS = "Préparation de la scène 3D…";
  const readyS = "Scène 3D prête : cliquez sur le scan pour poser un point";
  const missingS =
    "Les données 3D de la scène ne sont pas sur cet appareil : dessin sur le scan indisponible";
  const errorS = "Préparation de la scène 3D impossible";

  // data

  const pickingStatus = useScene3dPickingStatus();

  // helpers

  if (!pickingStatus) return null;
  const { status, done, total, error } = pickingStatus;
  const isLoading = status === "LOADING";
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const label =
    status === "READY"
      ? readyS
      : status === "MISSING"
        ? missingS
        : status === "ERROR"
          ? `${errorS}${error ? ` (${error})` : ""}`
          : `${loadingS} ${total > 0 ? `${percent} %` : ""}`;
  const color =
    status === "READY"
      ? "success.main"
      : status === "LOADING"
        ? "text.secondary"
        : "error.main";

  // render

  return (
    <Box
      sx={{
        px: 1,
        py: 0.75,
        borderRadius: 1,
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
        {label}
      </Typography>
      {isLoading && (
        <LinearProgress
          variant={total > 0 ? "determinate" : "indeterminate"}
          value={percent}
        />
      )}
    </Box>
  );
}
