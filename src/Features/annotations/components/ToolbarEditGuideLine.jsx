import { Box, IconButton, Tooltip } from "@mui/material";
import SwapHoriz from "@mui/icons-material/SwapHoriz";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedGuideLineData from "Features/annotations/hooks/useSelectedGuideLineData";
import useApplyGuideLineSlope from "Features/annotations/hooks/useApplyGuideLineSlope";
import useInvertGuideLine from "Features/annotations/hooks/useInvertGuideLine";
import useUpdateGuideLine from "Features/annotations/hooks/useUpdateGuideLine";

import FieldAnnotationHeight from "./FieldAnnotationHeight";
import FieldGuideLineIsStairsSwitch from "./FieldGuideLineIsStairsSwitch";

// Inline editor for the currently sub-selected guideLine ("Ligne guide"). Shows
// the slope (%) and the height delta ΔH (m) — editing either one updates the
// guideLine's slopePct — plus an "Inverser" button that flips the ramp
// direction. Same field UI as the height / offset fields of the toolbar.
// In stairs mode (isStairs) the slope field is replaced by the step count
// ("Nbre marches"); ΔH keeps driving slopePct so the flight total height stays
// editable.
export default function ToolbarEditGuideLine({ accentColor }) {
  // data

  const {
    annotation,
    index,
    slopePct,
    guideLine,
    hasGuideLine,
    isStairs,
    stairsCount,
  } = useSelectedGuideLineData();
  const applySlope = useApplyGuideLineSlope();
  const invertGuideLine = useInvertGuideLine();
  const updateGuideLine = useUpdateGuideLine();
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;

  // helpers

  // Horizontal length of the guideLine in meters (points are pixel-resolved).
  const lengthPx = (() => {
    const pts = guideLine?.points || [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (
        typeof a?.x !== "number" ||
        typeof a?.y !== "number" ||
        typeof b?.x !== "number" ||
        typeof b?.y !== "number"
      ) {
        continue;
      }
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return total;
  })();
  const lengthM =
    Number.isFinite(meterByPx) && meterByPx > 0 ? lengthPx * meterByPx : 0;
  const deltaHEnabled = lengthM > 0;

  const round = (v, decimals) => {
    const f = 10 ** decimals;
    return Math.round((Number(v) || 0) * f) / f;
  };

  // Display: slope with 1 decimal, ΔH with 3 decimals.
  const slopeDisplay = round(slopePct, 1);
  const deltaH = deltaHEnabled ? round((slopePct / 100) * lengthM, 3) : 0;

  // Stable synthetic ids so FieldAnnotationHeight's sync effect tracks the
  // selected guideLine and re-syncs when its slope changes externally.
  const glId = `${annotation?.id}::${index}`;

  // handlers

  function handleSlopeChange(o) {
    applySlope(index, Number(o.slopePct) || 0);
  }

  function handleDeltaHChange(o) {
    if (!deltaHEnabled) return;
    const nextDeltaH = Number(o.deltaH) || 0;
    // Keep 3 significant decimals in memory when deriving slope from height.
    applySlope(index, round((nextDeltaH / lengthM) * 100, 3));
  }

  function handleInvert() {
    invertGuideLine({ index });
  }

  function handleIsStairsChange(checked) {
    // Seed an explicit stairsCount when enabling so the DB record is complete.
    updateGuideLine(index, {
      isStairs: checked,
      ...(checked ? { stairsCount } : {}),
    });
  }

  function handleStairsCountChange(o) {
    updateGuideLine(index, { stairsCount: o.stairsCount });
  }

  // render

  if (!annotation || !hasGuideLine) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1.25,
        py: 0.25,
        gap: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <FieldGuideLineIsStairsSwitch
        checked={isStairs}
        onChange={handleIsStairsChange}
      />
      {isStairs ? (
        <FieldAnnotationHeight
          annotation={{ id: glId, stairsCount }}
          field="stairsCount"
          label="Nbre marches"
          unit=""
          onChange={handleStairsCountChange}
        />
      ) : (
        <FieldAnnotationHeight
          annotation={{ id: glId, slopePct: slopeDisplay }}
          field="slopePct"
          label="Pente"
          unit="%"
          onChange={handleSlopeChange}
        />
      )}
      <FieldAnnotationHeight
        annotation={{ id: glId, deltaH }}
        field="deltaH"
        label="ΔH"
        unit="m"
        onChange={handleDeltaHChange}
        disabled={!deltaHEnabled}
      />
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Inverser le sens de la pente">
        <IconButton
          size="small"
          onClick={handleInvert}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: accentColor || "text.primary",
              bgcolor: (accentColor || "#000") + "18",
            },
          }}
        >
          <SwapHoriz fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
