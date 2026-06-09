import { useMemo } from "react";

import computeMeshCells from "Features/mesh/utils/computeMeshCells";

// Live mesh cells for the given outline + draft cut lines. Recomputes whenever a
// line is dragged so the per-cell surfaces update in real time.
export default function useMeshCells({ outlinePoints, meshLines, meterByPx }) {
  // a stable key over the line geometry so the memo recomputes on every drag
  const linesKey = useMemo(
    () =>
      (meshLines ?? [])
        .map(
          (l) =>
            `${l.id}:${l.p1?.x?.toFixed(2)},${l.p1?.y?.toFixed(2)},${l.p2?.x?.toFixed(
              2
            )},${l.p2?.y?.toFixed(2)}`
        )
        .join("|"),
    [meshLines]
  );

  const outlineKey = useMemo(
    () =>
      (outlinePoints ?? [])
        .map((p) => `${p.x?.toFixed(2)},${p.y?.toFixed(2)}`)
        .join("|"),
    [outlinePoints]
  );

  return useMemo(
    () => computeMeshCells(outlinePoints, meshLines, { meterByPx }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outlineKey, linesKey, meterByPx]
  );
}
