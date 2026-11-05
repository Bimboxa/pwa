// components/HelperScale.jsx
import { useState, useImperativeHandle, forwardRef } from "react";
import { Box, Typography } from "@mui/material";

import { SCALE_STEPS } from "../utils/scaleSteps";

const HelperScale = forwardRef(({ meterByPx, basePoseK = 1, initialWorldK = 1 }, ref) => {


  // 1. État LOCAL (Seul ce composant se re-rendra quand le zoom change)
  const [worldK, setWorldK] = useState(initialWorldK);

  // 2. Exposer la commande de mise à jour
  useImperativeHandle(ref, () => ({
    updateZoom: (newK) => {
      // Optimisation : ne pas re-rendre si le changement est infime ou identique
      setWorldK(prev => (prev === newK ? prev : newK));
    }
  }));

  // --- LOGIQUE DE CALCUL (inchangée) ---
  const noScaleS = "Echelle non définie";
  const scaleSteps = SCALE_STEPS;

  // Calculate effective scale factor
  const totalScale = (worldK || 1) * (basePoseK || 1);
  const targetWidthPx = 200;

  let width = "100px";
  let label = scaleSteps[0].label;

  if (meterByPx && totalScale > 0) {
    let bestDiff = Infinity;
    for (const step of scaleSteps) {
      const baseMapPixels = step.meters / meterByPx;
      const screenPixels = baseMapPixels * totalScale;
      const diff = Math.abs(screenPixels - targetWidthPx);
      if (diff < bestDiff) {
        bestDiff = diff;
        width = `${Math.round(screenPixels)}px`;
        label = step.label;
      }
      if (screenPixels > targetWidthPx && diff > bestDiff) break;
    }
  }

  // --- RENDER ---
  if (!meterByPx) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          pointerEvents: "auto", // Important pour que l'utilisateur puisse interagir si besoin
          userSelect: "none"
        }}
      >
        <Typography sx={{ fontSize: "12px", color: "text.secondary", textShadow: "0px 0px 2px white" }}>
          {label}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box sx={{ width: "1px", height: "6px", bgcolor: "black" }} />
          <Box sx={{ width, height: "1px", bgcolor: "black" }} />
          <Box sx={{ width: "1px", height: "6px", bgcolor: "black" }} />
        </Box>
      </Box>
    </Box>

  );
});

export default HelperScale;