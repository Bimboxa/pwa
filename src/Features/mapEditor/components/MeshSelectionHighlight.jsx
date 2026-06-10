import { useMemo } from "react";
import { useSelector } from "react-redux";

import { useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import {
  selectSelectedMeshCellId,
  selectSelectedMeshParentId,
} from "Features/selection/selectionSlice";

// Non-interactive overlay: when the selected annotation is a maille (mesh cell),
// highlight the whole mesh group of its parent. The clicked maille (primary) is
// emphasized; its siblings get a lighter style. Driven entirely by the selection
// slice (see selectSelectedMeshParentId / selectSelectedMeshCellId).
//
// Rendered inside StaticMapContent's base-pose <g>, so `annotation.points` (pixel
// space, resolved by useAnnotationsV2) share this coordinate system.
function cellPath(points) {
  if (!points?.length) return "";
  return (
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"
  );
}

export default function MeshSelectionHighlight({ annotations }) {
  const theme = useTheme();
  const H = theme.palette.primary.main;

  const parentId = useSelector(selectSelectedMeshParentId);
  const primaryId = useSelector(selectSelectedMeshCellId);

  const cells = useMemo(() => {
    if (!parentId || !annotations) return [];
    return annotations.filter(
      (a) => a.isMeshCell && a.parentAnnotationId === parentId
    );
  }, [annotations, parentId]);

  if (!cells.length) return null;

  return (
    <g style={{ pointerEvents: "none" }}>
      {cells.map((cell) => {
        const isPrimary = cell.id === primaryId;
        return (
          <path
            key={`mesh-hl-${cell.id}`}
            d={cellPath(cell.points)}
            fill={alpha(H, isPrimary ? 0.45 : 0.18)}
            stroke={isPrimary ? H : alpha(H, 0.5)}
            strokeWidth={isPrimary ? 2 : 1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}
