import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";

import { revolutionAxisDraftThreedRef } from "../state/lastRevolutionAxisHitStore";

// ---------------------------------------------------------------------------
// SectionRevolutionAxisRadiusConstraintThreed — « Contraintes » body of the
// 3D revolution axis draw: the live radius of the pending second click and
// the step hint. The radius is polled from a ref at animation-frame rate,
// like SectionCircleRadiusConstraint in 2D (which reads the 2D preview and
// would show 0 here). No typed constraint: live display only.
// ---------------------------------------------------------------------------

export default function SectionRevolutionAxisRadiusConstraintThreed() {
  // strings

  const radiusS = "Rayon";
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <ConstraintValueChip
        label={radiusS}
        value={liveDisplay}
        unit="m"
        lockable={false}
      />
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontSize: "0.75rem", px: 0.5 }}
      >
        {hasCenter ? edgeS : centerS}
      </Typography>
    </Box>
  );
}
