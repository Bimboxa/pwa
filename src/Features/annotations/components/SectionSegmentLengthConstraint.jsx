import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import segmentLengthPxRef from "Features/mapEditor/state/segmentLengthPxRef";
import parseConstraintLengths from "Features/mapEditor/utils/parseConstraintLengths";
import formatSegmentLengthDisplay from "Features/annotations/utils/formatSegmentLengthDisplay";
import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";
import ConstraintShortcutRow from "Features/mapEditor/components/ConstraintShortcutRow";

// ---------------------------------------------------------------------------
// SectionSegmentLengthConstraint — « Contraintes » body of the segment
// drawing modes (SEGMENT_DRAWING_MODES): the length of the segment being
// drawn — live from the preview (segmentLengthPxRef), or the typed length
// (constraintBuffer, locked) — and the keys.
// ---------------------------------------------------------------------------

export default function SectionSegmentLengthConstraint() {
  // strings

  const segmentS = "Segment en cours";
  const constrainS = "Contraindre";
  const chainS = "Enchaîner";
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
    (px) => formatSegmentLengthDisplay({ px, meterByPx }).value,
    [meterByPx]
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

  // A ";"-separated series places one segment per value in a single click, so
  // show the series spaced out plus its total — the total is what the rubber
  // band spans while aiming.
  const series = locked ? parseConstraintLengths(constraintBuffer) : null;
  const isSeries = (series?.lengths.length ?? 0) > 1;
  const displayValue = locked
    ? constraintBuffer.split(";").join(" ; ")
    : liveDisplay;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <ConstraintValueChip
        label={segmentS}
        value={displayValue}
        unit={unit}
        locked={locked}
      />
      {isSeries && (
        <Typography
          variant="caption"
          sx={{ color: "primary.main", fontSize: "0.75rem", px: 0.5 }}
        >
          {`= ${series.total.toFixed(hasScale ? 2 : 0)} ${unit} · ${series.lengths.length} segments`}
        </Typography>
      )}
      <ConstraintShortcutRow label={constrainS} keys={["0-9"]} />
      <ConstraintShortcutRow label={chainS} keys={[";"]} />
      <ConstraintShortcutRow label={eraseS} keys={["⌫"]} />
    </Box>
  );
}
