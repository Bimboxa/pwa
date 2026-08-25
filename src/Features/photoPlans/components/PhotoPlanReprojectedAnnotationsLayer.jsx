import { useMemo } from "react";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import usePhotoPlans from "../hooks/usePhotoPlans";
import applyPhotoPlanHomography from "../utils/applyPhotoPlanHomography";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Read-only reprojection, over the ORIGINAL photo, of the annotations drawn
// on its flattened ("mise à plat") counterparts — whole-photo AND zone
// plans: flattened px -> plane meters (bake-time frame) -> photo via the
// bake-time Hinv SNAPSHOT (never the live calibration — a re-Positionner
// must not shift annotations bound to the baked image). Straight segments
// stay straight under a homography; arcs are tessellated first.
// Display-only (pointerEvents none).

const ARC_SAMPLES = 12;

// One flattened baseMap = one annotations feed (hooks can't run in a loop).
function ReprojectedPlanAnnotations({ plan, photoSize, containerK }) {
  const frame = plan.flattenedFrame;

  const rawAnnotations = useAnnotationsV2({
    enabled: Boolean(frame),
    filterByBaseMapId: plan.flattenedBaseMapId,
    sortByOrderIndex: true,
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
  });

  const mapped = useMemo(() => {
    if (!frame?.Hinv || !photoSize?.width || !photoSize?.height) return [];
    const { uMin, vMax, pxPerM, Hinv } = frame;

    const mapPoints = (points, closeLine) => {
      if (!points?.length) return null;
      const out = [];
      for (const p of expandArcsInPath(points, ARC_SAMPLES, closeLine)) {
        const u = uMin + p.x / pxPerM;
        const v = vMax - p.y / pxPerM;
        const n = applyPhotoPlanHomography(Hinv, { x: u, y: v });
        if (!n) return null; // beyond the photo horizon — skip the shape
        out.push({ x: n.x * photoSize.width, y: n.y * photoSize.height });
      }
      return out;
    };

    const result = [];
    for (const a of rawAnnotations ?? []) {
      if (a.type === "TEXT" || a.type === "LABEL") continue;
      const isClosed = ["POLYGON", "RECTANGLE"].includes(a.type);
      const points = mapPoints(a.points, isClosed);
      if (!points) continue;
      const cuts = [];
      let ok = true;
      for (const cut of a.cuts ?? []) {
        const cutPoints = mapPoints(cut?.points ?? [], true);
        if (!cutPoints) {
          ok = false;
          break;
        }
        cuts.push({ ...cut, points: cutPoints });
      }
      if (!ok) continue;
      result.push({ ...a, points, cuts });
    }
    return result;
  }, [rawAnnotations, frame, photoSize?.width, photoSize?.height]);

  return mapped.map((annotation) => (
    <NodeAnnotationStatic
      key={annotation.id}
      annotation={annotation}
      containerK={containerK}
    />
  ));
}

export default function PhotoPlanReprojectedAnnotationsLayer({
  baseMap,
  basePose,
}) {
  const { value: photoPlans = [] } = usePhotoPlans({
    baseMapId: baseMap?.isPhoto ? baseMap.id : null,
  });
  const plansWithFrame = photoPlans.filter(
    (p) => p.flattenedBaseMapId && p.flattenedFrame
  );

  const photoSize = baseMap?.getImageSize?.();

  if (
    !baseMap?.isPhoto ||
    plansWithFrame.length === 0 ||
    !photoSize?.width ||
    !photoSize?.height
  ) {
    return null;
  }

  return (
    <g
      pointerEvents="none"
      opacity={0.65}
      transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
    >
      {plansWithFrame.map((plan) => (
        <ReprojectedPlanAnnotations
          key={plan.id}
          plan={plan}
          photoSize={photoSize}
          containerK={basePose.k}
        />
      ))}
    </g>
  );
}
