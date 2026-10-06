import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import { revolutionAxisDraftThreedRef } from "../state/lastRevolutionAxisHitStore";

// Bottom-bar companion of the 3D revolution axis draw (next to the draft
// toolbar: colour, Offset, ht.): the live radius of the pending second click
// and the step hint. The radius is polled from a ref at animation-frame
// rate, like CircleRadiusBottomBar in 2D (which reads the 2D preview and
// would show 0 here).
export default function RevolutionAxisRadiusBottomBarThreed() {
  // strings

  const radiusS = "Rayon :";
  const centerS = "1ᵉʳ clic : centre de l'axe sur un plan horizontal";
  const edgeS = "2ᵉ clic : rayon et direction du diamètre (Échap : annuler)";

  // data

  const hasCenter = useSelector((s) =>
    Boolean(s.threedEditor.revolutionAxisDrawMode.centerPoint)
  );

  // state

  const [liveDisplay, setLiveDisplay] = useState("0");
  const rafRef = useRef(null);

  useEffect(() => {
    let lastUpdate = 0;
    const INTERVAL = 100; // ms
    function tick(timestamp) {
      if (timestamp - lastUpdate >= INTERVAL) {
        lastUpdate = timestamp;
        const m = revolutionAxisDraftThreedRef.radiusM ?? 0;
        setLiveDisplay(m < 0.01 ? "0" : m.toFixed(3));
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // render

  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1, py: 0.5 }}
    >
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          fontSize: "0.8rem",
          whiteSpace: "nowrap",
        }}
      >
        {radiusS}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            fontSize: "0.8rem",
            minWidth: 48,
            textAlign: "right",
          }}
        >
          {liveDisplay}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontSize: "0.75rem" }}
        >
          m
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          fontSize: "0.75rem",
          whiteSpace: "nowrap",
        }}
      >
        {hasCenter ? edgeS : centerS}
      </Typography>
    </Box>
  );
}
