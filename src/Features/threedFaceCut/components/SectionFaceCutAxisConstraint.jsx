import { useSyncExternalStore } from "react";
import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import ConstraintValueChip from "Features/mapEditor/components/ConstraintValueChip";
import ConstraintShortcutRow from "Features/mapEditor/components/ConstraintShortcutRow";

import {
  getFaceCutAxisHover,
  subscribeFaceCutAxisHover,
} from "../services/faceCutAxisStore";
import { getFaceCutAxis } from "../utils/faceCutTools";

// ---------------------------------------------------------------------------
// SectionFaceCutAxisConstraint — « Contraintes » body of « Découpe
// horizontale / verticale » (Coupe face, 3D): the distance from the face's
// bottom corner to the cut line — live from the hover
// (FaceCutAxisOverlayThreed), or the typed constraint (locked) —, and the
// side the vertical cut measures from (S).
// ---------------------------------------------------------------------------

export default function SectionFaceCutAxisConstraint() {
  // strings

  const heightS = "Hauteur de coupe";
  const distanceS = "Distance de coupe";
  const typeS = "Contraindre";
  const eraseS = "Effacer";
  const sideS = "Côté";
  const leftS = "gauche";
  const rightS = "droite";

  // data

  const axis = useSelector((s) =>
    getFaceCutAxis(s.mapEditor.enabledDrawingMode)
  );
  const constraintBuffer = useSelector((s) => s.mapEditor.constraintBuffer);
  const side = useSelector((s) => s.threedEditor.drawingMode.faceCutSide);
  const hover = useSyncExternalStore(
    subscribeFaceCutAxisHover,
    getFaceCutAxisHover
  );

  // helpers

  const locked = constraintBuffer.length > 0;
  const liveDistance = hover?.distance;
  const displayValue = locked
    ? constraintBuffer
    : Number.isFinite(liveDistance)
      ? liveDistance.toFixed(3)
      : "—";

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <ConstraintValueChip
        label={axis === "H" ? heightS : distanceS}
        value={displayValue}
        unit="m"
        locked={locked}
      />
      <ConstraintShortcutRow label={typeS} keys={["0-9"]} />
      <ConstraintShortcutRow label={eraseS} keys={["⌫"]} />
      {axis === "V" && (
        <ConstraintShortcutRow
          label={`${sideS} : ${side === "RIGHT" ? rightS : leftS}`}
          keys={["S"]}
        />
      )}
    </Box>
  );
}
