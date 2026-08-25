import { useMemo } from "react";
import { useSelector } from "react-redux";

import usePhotoPlanZones from "../hooks/usePhotoPlanZones";

// World-space SVG layer of the map editor: while a photoPlan is selected in
// the chips band, its zone stays sharp and the REST of the photo is blurred
// (blurred image copy + white veil, clipped OUTSIDE the source polygon via
// an even-odd clipPath) with the zone outlined. Display-only.
export default function PhotoPlanMaskLayer({ baseMap, basePose }) {
  const selectedPhotoPlanId = useSelector(
    (s) => s.photoPlans.selectedPhotoPlanIdInMap
  );
  const imageSize = baseMap?.getImageSize?.();
  const imageUrl = baseMap?.getUrl?.();

  const { value: zones } = usePhotoPlanZones({
    baseMapId: baseMap?.isPhoto && selectedPhotoPlanId ? baseMap.id : null,
    imageSize,
  });

  const zone = useMemo(
    () => zones.find((z) => z.plan.id === selectedPhotoPlanId) ?? null,
    [zones, selectedPhotoPlanId]
  );

  if (
    !baseMap?.isPhoto ||
    !selectedPhotoPlanId ||
    !zone ||
    !imageUrl ||
    !imageSize?.width ||
    !imageSize?.height
  ) {
    return null;
  }

  const { width: W, height: H } = imageSize;
  const ringD =
    zone.ringPx.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + " Z";
  const holesD = zone.holesPx
    .map(
      (h) => h.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + " Z"
    )
    .join(" ");
  // Even-odd: full image rect + zone ring => the clip covers everything
  // OUTSIDE the ring; appending the holes re-covers them (out of the zone).
  const outsideD = `M0 0 H${W} V${H} H0 Z ${ringD} ${holesD}`;
  const clipId = `photo-plan-mask-${zone.plan.id}`;
  const blurId = `photo-plan-blur-${zone.plan.id}`;
  const blurStd = Math.max(4, W / 200);

  return (
    <g
      pointerEvents="none"
      transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={outsideD} clipRule="evenodd" />
        </clipPath>
        <filter id={blurId} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation={blurStd} />
        </filter>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={imageUrl}
          x={0}
          y={0}
          width={W}
          height={H}
          filter={`url(#${blurId})`}
          preserveAspectRatio="none"
        />
        <rect x={0} y={0} width={W} height={H} fill="white" opacity={0.45} />
      </g>
      <path
        d={ringD}
        fill="none"
        stroke="#2196f3"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      {zone.holesPx.map((h, i) => (
        <path
          key={i}
          d={h.map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`).join(" ") + " Z"}
          fill="none"
          stroke="#2196f3"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
