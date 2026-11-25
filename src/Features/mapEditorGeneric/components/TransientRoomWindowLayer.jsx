import { forwardRef, useImperativeHandle, useState } from "react";

const COLOR = "#00a000";

/**
 * Dashed outline of the computation window of the « Pièce » drawing tool
 * (the part of the plan analysed around the cursor).
 *
 * Imperative API:
 *   update([{x,y}, ...])  corners, in the coordinates of the parent group
 *   clear()
 */
const TransientRoomWindowLayer = forwardRef((props, ref) => {
  // state

  const [points, setPoints] = useState(null);

  useImperativeHandle(ref, () => ({
    update: (newPoints) => setPoints(newPoints || null),
    clear: () => setPoints(null),
  }));

  // render

  if (!points || points.length < 3) return null;

  return (
    <polygon
      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
      fill="none"
      stroke={COLOR}
      strokeWidth={1}
      strokeDasharray="6 4"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
});

TransientRoomWindowLayer.displayName = "TransientRoomWindowLayer";

export default TransientRoomWindowLayer;
