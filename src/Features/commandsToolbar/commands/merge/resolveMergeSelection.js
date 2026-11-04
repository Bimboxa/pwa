import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import isAnnotationConvertibleToMesh3d from "Features/annotationMesh3d/utils/isAnnotationConvertibleToMesh3d";

import { EDITOR_3D } from "../../constants/commandEditors";

// Pure resolution of the « Fusionner les annotations » target — shared by
// the command (getState / Button) and by the mesh merge service.
//
// Two modes:
// - "2D": the parametric merge (useMergeAnnotations — polylines chained,
//   polygons unioned); the annotations keep their 2D nature.
// - "MESH": the 3D editor's mesh merge (mergeAnnotationsToMeshService): the
//   seed receives the union mesh (isMesh3d), the others are deleted. Needs
//   the live 3D scene, so it is offered in the 3D editor only.
// The 3D editor is hybrid: "2D" when it applies, "MESH" otherwise.

export const MERGE_MODES = { TWO_D: "2D", MESH: "MESH" };

// Template rule: one template at most. All templated alike, all
// template-less, or one template plus template-less shapes — these take the
// template by being absorbed, so the seed is the first annotation carrying it.
export function resolveMergeTemplate(annotations) {
  const ids = [
    ...new Set(annotations.map((a) => a?.annotationTemplateId).filter(Boolean)),
  ];
  if (ids.length > 1) return { ok: false, templateId: null, seedIndex: 0 };
  const templateId = ids[0] ?? null;
  const seedIndex = templateId
    ? Math.max(
        0,
        annotations.findIndex((a) => a?.annotationTemplateId === templateId)
      )
    : 0;
  return { ok: true, templateId, seedIndex };
}

const num = (v) => Number(v) || 0;
const same = (values, tol = 1e-6) =>
  values.every((v) => Math.abs(v - values[0]) <= tol);
const hasVertexOffsets = (a) =>
  (a.points || []).some((p) => num(p?.offsetTop) || num(p?.offsetBottom));

// The parametric merge applies: one drawing shape (lines or surfaces), no
// mesh. In the 3D editor the merged result keeps the seed's 3D attributes
// only, so the annotations must agree on them — else the mesh merge.
export function is2dMergeApplicable(annotations, editor) {
  if (annotations.some((a) => a.isMesh3d)) return false;
  const shapes = new Set(
    annotations.map((a) => resolveDrawingShapeFromType(a.type))
  );
  if (shapes.size !== 1) return false;
  const shape = [...shapes][0];
  if (shape !== "POLYLINE" && shape !== "POLYGON") return false;
  if (editor !== EDITOR_3D) return true;
  if (!same(annotations.map((a) => num(a.offsetZ)))) return false;
  if (!same(annotations.map((a) => num(a.height)))) return false;
  if (annotations.some(hasVertexOffsets)) return false;
  if (shape === "POLYLINE") {
    if (!same(annotations.map((a) => num(a.strokeWidth)))) return false;
    const units = new Set(annotations.map((a) => a.strokeWidthUnit ?? "PX"));
    if (units.size !== 1) return false;
  }
  return true;
}

export function isMeshMergeCandidate(a) {
  return Boolean(a) && (a.isMesh3d || isAnnotationConvertibleToMesh3d(a));
}

// The annotations the command may act on: the resolved selection without
// the synthetic footprints (another plan's cutter, a revolution's plan).
export function getMergeCandidates(ctx) {
  return (ctx.selectedAnnotations || []).filter(
    (a) => a && !isForeignFootprintId(a.id) && !a.isRevolutionFootprint
  );
}

// Why the target is null — one of these keys, for getState's reason.
export const MERGE_UNAVAILABLE = {
  TOO_FEW: "TOO_FEW",
  MIXED_BASE_MAPS: "MIXED_BASE_MAPS",
  MIXED_TEMPLATES: "MIXED_TEMPLATES",
  MESH_IN_2D: "MESH_IN_2D",
  NOT_MERGEABLE: "NOT_MERGEABLE",
};

// { mode, shape?, annotations: [seed, ...others] } or { unavailable }.
export function resolveMergeTarget(ctx) {
  const candidates = getMergeCandidates(ctx);
  if (candidates.length < 2) {
    return { unavailable: MERGE_UNAVAILABLE.TOO_FEW };
  }
  if (candidates.some((a) => a.baseMapId !== candidates[0].baseMapId)) {
    return { unavailable: MERGE_UNAVAILABLE.MIXED_BASE_MAPS };
  }
  const template = resolveMergeTemplate(candidates);
  if (!template.ok) {
    return { unavailable: MERGE_UNAVAILABLE.MIXED_TEMPLATES };
  }
  const seed = candidates[template.seedIndex];
  const annotations = [seed, ...candidates.filter((a) => a !== seed)];
  if (is2dMergeApplicable(annotations, ctx.editor)) {
    return {
      mode: MERGE_MODES.TWO_D,
      shape: resolveDrawingShapeFromType(seed.type),
      annotations,
    };
  }
  if (!annotations.every(isMeshMergeCandidate)) {
    return { unavailable: MERGE_UNAVAILABLE.NOT_MERGEABLE };
  }
  if (ctx.editor !== EDITOR_3D) {
    return { unavailable: MERGE_UNAVAILABLE.MESH_IN_2D };
  }
  return { mode: MERGE_MODES.MESH, annotations };
}

export function getMergeTarget(ctx) {
  const target = resolveMergeTarget(ctx);
  return target.mode ? target : null;
}
