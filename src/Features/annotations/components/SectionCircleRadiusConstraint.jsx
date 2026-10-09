import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import segmentLengthPxRef from "Features/mapEditor/state/segmentLengthPxRef";
import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";
import ConstraintShortcutRow from "Features/mapEditor/components/ConstraintShortcutRow";

// ---------------------------------------------------------------------------
// SectionCircleRadiusConstraint — « Contraintes » body of the center/radius
// circle tools. Reuses the same constraint buffer as the segment-length lock
// (digits typed while drawing → constraintBuffer → fixedLength), and the
// live radius is read from segmentLengthPxRef (distance center→cursor,
// populated by the preview).
// ---------------------------------------------------------------------------

export default function SectionCircleRadiusConstraint() {
  // strings

  const radiusS = "Rayon";
  const constrainS = "Contraindre";
  const validateS = "Valider";
  const eraseS = "Effacer";

  // data

  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);

  // state

  const [liveDisplay, setLiveDisplay] = useState("0");
  const rafRef = useRef(null);

  // helpers

  const unit = hasScale ? "m" : "px";
  const locked = constraintBuffer.length > 0;

  const formatLength = useCallback(
    (px) => {
      if (!Number.isFinite(px) || px < 0) return "0";
      const value = hasScale ? px * meterByPx : px;
      if (value < 0.01) return "0";
      return hasScale ? value.toFixed(3) : Math.round(value).toString();
    },
    [hasScale, meterByPx]
  );

  // Live display update via requestAnimationFrame (throttled to ~10fps)
  useEffect(() => {
    if (locked) return;

    let lastUpdate = 0;
    const INTERVAL = 100; // ms

    function tick(timestamp) {
      if (timestamp - lastUpdate >= INTERVAL) {
        lastUpdate = timestamp;
        const px = segmentLengthPxRef.current ?? 0;
        setLiveDisplay(formatLength(px));
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [locked, formatLength]);

  // render

  const displayValue = locked ? constraintBuffer : liveDisplay;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <ConstraintValueChip
        label={radiusS}
        value={displayValue}
        unit={unit}
        locked={locked}
      />
      <ConstraintShortcutRow label={constrainS} keys={["0-9"]} />
      <ConstraintShortcutRow label={validateS} keys={["↵"]} />
      <ConstraintShortcutRow label={eraseS} keys={["⌫"]} />
    </Box>
  );
}
