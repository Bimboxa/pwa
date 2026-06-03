import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";
import { resolveProfileFromDb } from "Features/annotations/hooks/useProfileResolution";
import { expandArcsInPathWithHiddenMap } from "Features/geometry/utils/arcSampling";

import pixelToWorld from "./pixelToWorld";
import createAnnotationObject3D, { makeMaterial } from "./createAnnotationObject3D";
import { sweepProfileAlongGuide } from "./buildExtrudedProfileMesh";

const GUIDE_ARC_SAMPLES = 6;

/**
 * Build a fully-resolved DISPLAY object for an annotation, suitable to be the
 * subject of a boolean carve. For most types this is the synchronous
 * `createAnnotationObject3D` result. EXTRUSION_PROFILE guides are special: their
 * normal builder returns an async live-updating placeholder (empty at the
 * synchronous carve moment), so here we resolve the profile from Dexie and build
 * the swept SURFACE directly — keeping it a surface so the boolean cuts
 * openings rather than carving a solid.
 *
 * @returns {Promise<import("three").Object3D|null>}
 */
export default async function buildResolvedSourceObjectAsync(
  annotation,
  baseMapForRender,
  options
) {
  if (!annotation || !baseMapForRender) return null;

  if (getShape3DKey(annotation.shape3D) === "EXTRUSION_PROFILE") {
    const profileTemplateId = annotation.shape3D?.profileTemplateId;
    if (!profileTemplateId) return null;
    const res = await resolveProfileFromDb(profileTemplateId);
    if (!res || !res.anchorPx || res.profiles.length === 0) return null;

    const { points: expandedPts, hiddenSegmentsIdx } =
      expandArcsInPathWithHiddenMap(
        annotation.points || [],
        GUIDE_ARC_SAMPLES,
        annotation.hiddenSegmentsIdx || [],
        !!annotation.closeLine
      );
    const guidePointsLocal = expandedPts.map((p) => ({
      ...pixelToWorld(p, baseMapForRender),
      type: p.type,
    }));
    if (guidePointsLocal.length < 2) return null;

    const material = makeMaterial(annotation, options);
    const verticalLift = Number(annotation.offsetZ) || 0;

    const group = sweepProfileAlongGuide({
      guidePointsLocal,
      hiddenSegmentsIdx: hiddenSegmentsIdx || [],
      profiles: res.profiles,
      anchorPx: res.anchorPx,
      verticalLift,
      material,
      extrusionOrientation: annotation.extrusionOrientation,
      closeLine: !!annotation.closeLine,
    });
    if (!group) return null;

    // Tag the swept surface mesh(es) so the carve pipeline can find them.
    group.traverse?.((c) => {
      if (c.isMesh) c.userData = { ...(c.userData ?? {}), role: "SOLID" };
    });
    return group;
  }

  return createAnnotationObject3D(annotation, baseMapForRender, options);
}
