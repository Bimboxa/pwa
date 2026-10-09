import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";
import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";
import ConstraintShortcutRow from "Features/mapEditor/components/ConstraintShortcutRow";
import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";

// ---------------------------------------------------------------------------
// SectionRectangleDimsConstraint — « Contraintes » body of the rectangle
// tools: one row per side (X / Y, or the user axis it runs along in 3D —
// then shown in that axis' colour) with the typed dimension (locked) or
// nothing yet, and the keys (target a side, sign, validate). Keys handled by
// InteractionLayer (2D) / useDrawingPointerHandlers (3D).
//
// unit: forced display unit — the 3D editor draws in metres whatever the
// main base map's scale (default: "m" when the main base map has a scale,
// "px" otherwise).
// ---------------------------------------------------------------------------

export default function SectionRectangleDimsConstraint({
  unit: unitProp = null,
}) {
  // strings

  const firstCornerS = "Cliquez pour créer le 1er angle.";
  const targetS = "Cibler un côté";
  const signS = "Signe";
  const validateS = "Valider";

  // data

  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const unit = unitProp ?? (hasScale ? "m" : "px");

  const rectXBuffer = useSelector((s) => s.mapEditor.rectXBuffer);
  const rectYBuffer = useSelector((s) => s.mapEditor.rectYBuffer);
  const rectCurrentAxis = useSelector((s) => s.mapEditor.rectCurrentAxis);
  const rectSideAxes = useSelector((s) => s.mapEditor.rectSideAxes);
  const rectHasFirstPoint = useSelector((s) => s.mapEditor.rectHasFirstPoint);

  // helpers

  function displayOf(buffer) {
    if (buffer.length > 0) return buffer;
    const value = parseRectBuffer(buffer);
    return Number.isFinite(value) ? value.toString() : "—";
  }

  // render

  if (!rectHasFirstPoint) {
    return (
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", fontSize: "0.85rem", px: 0.5 }}
      >
        {firstCornerS}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <ConstraintValueChip
        label={rectSideAxes[0]}
        labelColor={AXIS_COLORS[rectSideAxes[0]]}
        value={displayOf(rectXBuffer)}
        unit={unit}
        locked={rectXBuffer.length > 0}
        isActive={rectCurrentAxis === "x"}
      />
      <ConstraintValueChip
        label={rectSideAxes[1]}
        labelColor={AXIS_COLORS[rectSideAxes[1]]}
        value={displayOf(rectYBuffer)}
        unit={unit}
        locked={rectYBuffer.length > 0}
        isActive={rectCurrentAxis === "y"}
      />
      <ConstraintShortcutRow
        label={targetS}
        keys={[rectSideAxes[0], rectSideAxes[1]]}
      />
      <ConstraintShortcutRow label={signS} keys={["-"]} />
      <ConstraintShortcutRow label={validateS} keys={["↵"]} />
    </Box>
  );
}
