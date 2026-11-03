import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import applyProfileFromAnnotationService from "Features/elevation/services/applyProfileFromAnnotationService";
import mirrorProfilePointsAcrossGuide from "Features/elevation/utils/mirrorProfilePointsAcrossGuide";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import areBaseMapsParallel from "Features/baseMaps/js/areBaseMapsParallel";
import baseMapPointToBaseMap from "Features/baseMaps/js/baseMapPointToBaseMap";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";

import createAnnotationService from "./createAnnotationService";
import getNewAnnotationPropsFromAnnotationTemplate from "../utils/getNewAnnotationPropsFromAnnotationTemplate";
import {
  getAnnotationType,
  getConfigurableProps,
} from "../constants/drawingShapeConfig";

// « Extruder le long d'une ligne » (commandsToolbar EXTRUDE_ALONG_LINE): the
// selected POLYLINE is the PROFILE, the clicked annotation the GUIDE. A third
// annotation is created — an independent copy of the guide's ring (new
// db.points) carrying the profile as `profileLines[0]`, i.e. the existing
// inline-extrusion mechanism (getInlineExtrusionSetup + buildInlineExtrusionMesh
// sweep the cross-section along the whole chain). It stays linked to both
// sources through `sweepSources` so « Actualiser la 3D » (ToolbarEditAnnotation)
// rebuilds it after the guide or the profile changed.
//
// Two registrations of the profile, decided by the profile itself:
//   - ELEVATION: the profile has a vertex flagged `isBasePoint` ("Point de
//     référence"). It is an elevation drawing (X → signed section abscissa,
//     Y → height): applyProfileFromAnnotationService lays it across the guide
//     segment nearest to the base point, keeping `sourceAnnotationId` so the
//     Élévation « Actualiser » button still works.
//   - IN_PLACE (no base point, SketchUp « Suivez-moi » style): the profile
//     stays where it was drawn — its plan vertices become the profile line's
//     points, their vertex offsets (offsetBottom, drawn in 3D) the inline
//     heights — so the sweep passes exactly through the drawn profile.
//     getInlineExtrusionSetup registers it against the crossed / nearest guide
//     segment. A profile drawn flat on the plan gives a flat band.
//
// Base maps: the result is created on `targetBaseMapId` — the base map
// selected in the Dessin module (the caller's choice; falls back to the
// guide's base map). The profile and the guide may live on other base maps:
// every point is re-expressed in the target frame through the 3D placements
// (baseMapPointToBaseMap). The guide ring is projected along the target
// normal (its base map must be parallel to the target, else the path would
// collapse); an IN_PLACE profile keeps its world position — plan trace on the
// target, altitude relative to the target plane — so a profile drawn on a
// vertical elevation lands upright on the plan. Cross-base-map conversion
// needs every base map involved scaled (`meterByPx`).
//
// Template: the profile's annotationTemplate props (getNewAnnotationProps…),
// forced to POLYLINE; a templateless profile gives a templateless result that
// copies the profile's style props. The result is never `isProfile` itself,
// and a template shape3D EXTRUSION_PROFILE is dropped (it would win over the
// inline profileLines in createAnnotationObject3D).

export const SWEEP_MODE_ELEVATION = "ELEVATION";
export const SWEEP_MODE_IN_PLACE = "IN_PLACE";

export const SWEEP_GUIDE_TYPES = ["POLYLINE", "POLYGON"];

export const SWEEP_ERROR_MESSAGES = {
  MISSING_INPUT: "Sélectionnez un profil puis cliquez sur un guide.",
  SAME_ANNOTATION: "Le profil ne peut pas être son propre guide.",
  PROFILE_MISSING: "Le profil n'existe plus.",
  PROFILE_TYPE: "Le profil doit être une ligne.",
  PROFILE_GEOMETRY: "Le profil doit avoir au moins deux points.",
  GUIDE_MISSING: "Le guide n'existe plus.",
  GUIDE_TYPE: "Le guide doit être une ligne ou une surface.",
  GUIDE_GEOMETRY: "Le guide doit avoir au moins deux points.",
  TARGET_BASE_MAP_MISSING:
    "Aucun fond de plan sélectionné pour créer l'annotation.",
  GUIDE_NOT_PARALLEL:
    "Le guide doit être sur un fond de plan parallèle au fond de plan sélectionné.",
  BASE_MAP_SCALE:
    "Pour extruder entre fonds de plan, le profil, le guide et le fond de plan sélectionné doivent être mis à l'échelle.",
  NOT_A_SWEEP: "Cette annotation n'est pas une extrusion le long d'une ligne.",
};

export function getSweepMode(profile) {
  const hasBasePoint = (profile?.points ?? []).some((r) => r?.isBasePoint);
  return hasBasePoint ? SWEEP_MODE_ELEVATION : SWEEP_MODE_IN_PLACE;
}

// --- helpers -----------------------------------------------------------------

const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Raw refs of a ring paired with their db.points rows (orphans dropped).
async function readRing(refs) {
  const validRefs = (refs ?? []).filter((r) => r?.id);
  const rows = await db.points.bulkGet(validRefs.map((r) => r.id));
  return validRefs
    .map((ref, i) => ({ ref, row: rows[i] }))
    .filter(({ row }) => Number.isFinite(row?.x) && Number.isFinite(row?.y));
}

// Base map record + its reference image size, in the shape the baseMaps/js
// projections accept (`getImageSize`, the frame db.points are normalized in).
async function loadBaseMapFrame(baseMapId) {
  if (!baseMapId) return null;
  const record = await db.baseMaps.get(baseMapId);
  if (!record) return null;
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();
  const size = getBaseMapImageSizeFromRecord(record, versions);
  return { ...record, getImageSize: () => size };
}

function canProject(frame) {
  const size = frame?.getImageSize?.();
  return Boolean(size?.width && size?.height && frame?.meterByPx);
}

// (rel normalized in `source`, altitude along its normal) → { x, y, offset }
// in `target`. Identity on the same base map (no float round trip for the
// single-plan flow).
function makeFrameConverter(source, target) {
  if (!source || !target || source.id === target.id) {
    return (rel, altitude = 0) => ({ x: rel.x, y: rel.y, offset: altitude });
  }
  return (rel, altitude = 0) =>
    baseMapPointToBaseMap(rel, source, target, { altitude });
}

// Target frame + converters of the two sources, or { error }. The guide must
// be projectable along the target normal (parallel base maps); the profile
// only needs a scale when its vertices are swept IN_PLACE (the ELEVATION
// registration reads it in its own frame — an unscaled profile just loses
// the seed segment).
async function resolveFrames({ profile, guide, targetBaseMapId, mode }) {
  const target =
    (await loadBaseMapFrame(targetBaseMapId)) ??
    (await loadBaseMapFrame(guide.baseMapId));
  if (!target) return { error: "TARGET_BASE_MAP_MISSING" };

  const frameOf = async (baseMapId) =>
    baseMapId === target.id ? target : await loadBaseMapFrame(baseMapId);

  const guideFrame = await frameOf(guide.baseMapId);
  if (guideFrame && guideFrame.id !== target.id) {
    if (!areBaseMapsParallel(guideFrame, target)) {
      return { error: "GUIDE_NOT_PARALLEL" };
    }
    if (!canProject(guideFrame) || !canProject(target)) {
      return { error: "BASE_MAP_SCALE" };
    }
  }

  let profileFrame = profile ? await frameOf(profile.baseMapId) : null;
  if (profileFrame && profileFrame.id !== target.id) {
    const projectable = canProject(profileFrame) && canProject(target);
    if (!projectable && mode === SWEEP_MODE_IN_PLACE) {
      return { error: "BASE_MAP_SCALE" };
    }
    if (!projectable) profileFrame = null;
  }

  return {
    target,
    // A missing guide frame (deleted base map) keeps the coords as they are.
    guideToTarget: makeFrameConverter(guideFrame ?? target, target),
    profileToTarget: profileFrame
      ? makeFrameConverter(profileFrame, target)
      : null,
  };
}

// Independent copy of the guide's main ring: new db.points at the guide's
// vertices projected on the target base map, refs keeping their per-vertex
// props (type, offsets) and the hidden-segment flags remapped to the new ids.
async function copyGuideGeometry(
  guide,
  { projectId, listingId, target, guideToTarget }
) {
  const ring = await readRing(guide.points);
  if (ring.length < 2) return null;

  const idMap = new Map();
  const pointRecords = [];
  const points = ring.map(({ ref, row }) => {
    let newId = idMap.get(ref.id);
    if (!newId) {
      newId = nanoid();
      idMap.set(ref.id, newId);
      const p = guideToTarget({ x: row.x, y: row.y }) ?? row;
      pointRecords.push({
        id: newId,
        x: p.x,
        y: p.y,
        projectId,
        baseMapId: target.id,
        listingId: listingId ?? null,
      });
    }
    // Strip the source-only props: inline coords never belong in a ref, the
    // base point is a profile notion.
    const { x: _x, y: _y, isBasePoint: _b, id: _old, ...rest } = ref;
    return { ...rest, id: newId };
  });

  const hiddenSegmentsIdx = Array.isArray(guide.hiddenSegmentsIdx)
    ? [...guide.hiddenSegmentsIdx]
    : [];
  const hiddenSegmentsPointIds = Array.isArray(guide.hiddenSegmentsPointIds)
    ? guide.hiddenSegmentsPointIds.map((id) => idMap.get(id)).filter(Boolean)
    : null;

  return {
    pointRecords,
    fields: {
      points,
      closeLine: guide.type === "POLYGON" || Boolean(guide.closeLine),
      hiddenSegmentsIdx,
      hiddenSegmentsPointIds,
    },
  };
}

// IN_PLACE profile line: the profile's own vertices re-expressed in the
// target frame (plan trace + altitude above the target plane), heights =
// altitude relative to the result's offsetZ (inline heights are absolute,
// the 3D build lifts the sweep by the result's offsetZ).
async function buildInPlaceProfileLine(
  profile,
  { resultOffsetZ, projectId, listingId, target, profileToTarget }
) {
  const ring = await readRing(profile.points);
  if (ring.length < 2) return null;
  const pointRecords = [];
  const points = ring.map(({ ref, row }) => {
    const id = nanoid();
    const p = profileToTarget(
      { x: row.x, y: row.y },
      _num(profile.offsetZ) + _num(ref.offsetBottom)
    );
    pointRecords.push({
      id,
      x: p.x,
      y: p.y,
      projectId,
      baseMapId: target.id,
      listingId: listingId ?? null,
    });
    return {
      pointId: id,
      type: ref.type === "circle" ? "circle" : "square",
      height: p.offset - _num(resultOffsetZ),
    };
  });
  return {
    pointRecords,
    line: {
      points,
      ...(profile.closeLine ? { closeLine: true } : {}),
    },
  };
}

// ELEVATION registration: the guide segment nearest (in the target plan) to
// the profile's base point; 0 when the base point cannot be projected.
async function getSeedSegmentIndex(
  guide,
  profile,
  { target, guideToTarget, profileToTarget }
) {
  if (!profileToTarget) return 0;
  const baseRef = (profile.points ?? []).find((r) => r?.isBasePoint);
  if (!baseRef?.id) return 0;
  const baseRow = await db.points.get(baseRef.id);
  if (!Number.isFinite(baseRow?.x) || !Number.isFinite(baseRow?.y)) return 0;
  const base = profileToTarget({ x: baseRow.x, y: baseRow.y });
  if (!base) return 0;
  const size = target.getImageSize();
  const w = size?.width || 1;
  const h = size?.height || 1;
  const ring = await readRing(guide.points);
  const pts = ring
    .map(({ row }) => guideToTarget({ x: row.x, y: row.y }) ?? row)
    .map((p) => ({ x: p.x * w, y: p.y * h }));
  const n = pts.length;
  if (n < 2) return 0;
  const closed = guide.type === "POLYGON" || Boolean(guide.closeLine);
  const segCount = closed ? n : n - 1;
  const P = { x: base.x * w, y: base.y * h };
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < segCount; i += 1) {
    const A = pts[i];
    const B = pts[(i + 1) % n];
    const abx = B.x - A.x;
    const aby = B.y - A.y;
    const len2 = abx * abx + aby * aby;
    let t = len2 > 0 ? ((P.x - A.x) * abx + (P.y - A.y) * aby) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(P.x - (A.x + abx * t), P.y - (A.y + aby * t));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// Props of the result annotation: the profile's template (or its own style
// when templateless), forced to a POLYLINE on the target base map. A
// templateless result keeps the profile's offsetZ as a starting altitude
// (IN_PLACE heights are absolute anyway; ELEVATION lays the base point there).
async function buildResultProps(profile, guide, target) {
  const template = profile.annotationTemplateId
    ? await db.annotationTemplates.get(profile.annotationTemplateId)
    : null;
  let props;
  if (template) {
    props = getNewAnnotationPropsFromAnnotationTemplate(template);
    if (props.shape3D?.key === "EXTRUSION_PROFILE") delete props.shape3D;
    props.listingId = profile.listingId ?? template.listingId ?? null;
  } else {
    props = {
      isTemplateless: true,
      scopeId: profile.scopeId ?? null,
      listingId: profile.listingId ?? null,
    };
    const shape = profile.drawingShape ?? "POLYLINE";
    for (const key of getConfigurableProps(shape)) {
      if (profile[key] !== undefined && profile[key] !== null) {
        props[key] = profile[key];
      }
    }
    if (profile.offsetZ !== undefined) props.offsetZ = profile.offsetZ;
    if (profile.drawingShape) props.drawingShape = profile.drawingShape;
  }
  delete props.isProfile;
  props.type = "POLYLINE";
  if (getAnnotationType(props.drawingShape) !== "POLYLINE") {
    props.drawingShape = "POLYLINE";
  }
  return {
    ...props,
    projectId: guide.projectId,
    baseMapId: target.id,
    ...(profile.layerId ? { layerId: profile.layerId } : {}),
  };
}

async function loadSources(profileAnnotationId, guideAnnotationId) {
  const [profile, guide] = await Promise.all([
    db.annotations.get(profileAnnotationId),
    db.annotations.get(guideAnnotationId),
  ]);
  return {
    profile: profile && !profile.deletedAt ? profile : null,
    guide: guide && !guide.deletedAt ? guide : null,
  };
}

function checkGuide(guide) {
  if (!guide) return "GUIDE_MISSING";
  if (!SWEEP_GUIDE_TYPES.includes(guide.type)) return "GUIDE_TYPE";
  return null;
}

// --- services ----------------------------------------------------------------

// Creates the swept annotation on `targetBaseMapId` (the base map selected
// in the Dessin module; the guide's base map when omitted). Resolves to
// { annotationId, mode } or { error } (a key of SWEEP_ERROR_MESSAGES).
export async function createSweepAlongLineService({
  profileAnnotationId,
  guideAnnotationId,
  targetBaseMapId = null,
  dispatch,
}) {
  if (!profileAnnotationId || !guideAnnotationId) {
    return { error: "MISSING_INPUT" };
  }
  if (profileAnnotationId === guideAnnotationId) {
    return { error: "SAME_ANNOTATION" };
  }
  const { profile, guide } = await loadSources(
    profileAnnotationId,
    guideAnnotationId
  );
  if (!profile) return { error: "PROFILE_MISSING" };
  if (profile.type !== "POLYLINE") return { error: "PROFILE_TYPE" };
  const guideError = checkGuide(guide);
  if (guideError) return { error: guideError };

  const mode = getSweepMode(profile);
  const frames = await resolveFrames({
    profile,
    guide,
    targetBaseMapId,
    mode,
  });
  if (frames.error) return { error: frames.error };

  const props = await buildResultProps(profile, guide, frames.target);
  const geometry = await copyGuideGeometry(guide, {
    projectId: guide.projectId,
    listingId: props.listingId,
    ...frames,
  });
  if (!geometry) return { error: "GUIDE_GEOMETRY" };

  const id = nanoid();
  const annotation = {
    ...props,
    id,
    ...geometry.fields,
    sweepSources: { guideAnnotationId, profileAnnotationId },
  };

  let profilePointRecords = [];
  if (mode === SWEEP_MODE_IN_PLACE) {
    const built = await buildInPlaceProfileLine(profile, {
      resultOffsetZ: annotation.offsetZ,
      projectId: guide.projectId,
      listingId: props.listingId,
      ...frames,
    });
    if (!built) return { error: "PROFILE_GEOMETRY" };
    annotation.profileLines = [built.line];
    profilePointRecords = built.pointRecords;
  }
  const seedSegmentIndex =
    mode === SWEEP_MODE_ELEVATION
      ? await getSeedSegmentIndex(guide, profile, frames)
      : 0;

  let profileApplied = mode === SWEEP_MODE_IN_PLACE;
  await withUndoGroup(async () => {
    await db.transaction(
      "rw",
      db.points,
      db.annotations,
      db.listings,
      async () => {
        await db.points.bulkAdd([
          ...geometry.pointRecords,
          ...profilePointRecords,
        ]);
        if (annotation.annotationTemplateId) {
          await createAnnotationService(annotation);
        } else {
          await db.annotations.put(annotation);
        }
      }
    );
    if (mode === SWEEP_MODE_ELEVATION) {
      const idx = await applyProfileFromAnnotationService({
        annotationId: id,
        sourceAnnotationId: profileAnnotationId,
        seedSegmentIndex,
        invert: false,
      });
      profileApplied = Number.isInteger(idx);
    }
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return { annotationId: id, mode, profileApplied };
}

// IN_PLACE refresh of a mirrored line: the fresh copy of the profile's
// vertices is reflected across the registering segment of the fresh ring
// (both normalized in the target frame → pixels for the registration, back
// to normalized). null when degenerate.
function mirrorInPlaceProfileRecords(built, geometry, frames) {
  const size = frames.target?.getImageSize?.();
  if (!size?.width || !size?.height) return null;
  const toPx = (p) => ({ x: p.x * size.width, y: p.y * size.height });
  const byId = new Map(geometry.pointRecords.map((r) => [r.id, r]));
  const guideRaw = (geometry.fields.points ?? [])
    .map((ref) => {
      const row = byId.get(ref.id);
      return row ? { ...toPx(row), type: ref.type } : null;
    })
    .filter(Boolean);
  const closeLine = Boolean(geometry.fields.closeLine);
  const mirrored = mirrorProfilePointsAcrossGuide({
    guidePoints: expandArcsInPath(guideRaw, 6, closeLine),
    closeLine,
    profilePoints: built.pointRecords.map((r) => ({ ...r, ...toPx(r) })),
  });
  if (!mirrored) return null;
  return mirrored.map((r) => ({
    ...r,
    x: r.x / size.width,
    y: r.y / size.height,
  }));
}

// Rebuilds a swept annotation from its sources, on its own base map: the
// guide's ring is copied again and the profile re-applied (same registration
// rule). A deleted profile keeps the current profile line (the ring alone is
// refreshed).
// Resolves to { annotationId, mode, profileRefreshed } or { error }.
export async function refreshSweepAlongLineService({ annotationId, dispatch }) {
  const ann = await db.annotations.get(annotationId);
  const sources = ann?.sweepSources;
  if (!sources?.guideAnnotationId) return { error: "NOT_A_SWEEP" };
  const { profile, guide } = await loadSources(
    sources.profileAnnotationId,
    sources.guideAnnotationId
  );
  const guideError = checkGuide(guide);
  if (guideError) return { error: guideError };

  const mode = profile ? getSweepMode(profile) : null;
  const frames = await resolveFrames({
    profile,
    guide,
    targetBaseMapId: ann.baseMapId,
    mode,
  });
  if (frames.error) return { error: frames.error };

  const geometry = await copyGuideGeometry(guide, {
    projectId: ann.projectId,
    listingId: ann.listingId,
    ...frames,
  });
  if (!geometry) return { error: "GUIDE_GEOMETRY" };

  const prevLines = Array.isArray(ann.profileLines) ? ann.profileLines : [];
  const prevProfilePointIds = prevLines.flatMap((l) =>
    (l?.points ?? []).map((r) => r?.pointId).filter(Boolean)
  );
  const ringPointIds = (ann.points ?? []).map((r) => r?.id).filter(Boolean);

  // « Inverser » (mirrorProfileLineService) survives the refresh: the line
  // re-applied from the source is mirrored again.
  const mirror = Boolean(prevLines[0]?.mirror);

  let profileLines = prevLines;
  let profilePointRecords = [];
  let pointIdsToDelete = ringPointIds;
  if (mode === SWEEP_MODE_IN_PLACE) {
    const built = await buildInPlaceProfileLine(profile, {
      resultOffsetZ: ann.offsetZ,
      projectId: ann.projectId,
      listingId: ann.listingId,
      ...frames,
    });
    if (!built) return { error: "PROFILE_GEOMETRY" };
    if (mirror) {
      const mirrored = mirrorInPlaceProfileRecords(built, geometry, frames);
      if (!mirrored) return { error: "PROFILE_GEOMETRY" };
      built.pointRecords = mirrored;
      built.line = { ...built.line, mirror: true };
    }
    profileLines = [built.line];
    profilePointRecords = built.pointRecords;
    pointIdsToDelete = [...ringPointIds, ...prevProfilePointIds];
  } else if (mode === SWEEP_MODE_ELEVATION) {
    // applyProfileFromAnnotationService appends on an empty list → index 0.
    profileLines = [];
    pointIdsToDelete = [...ringPointIds, ...prevProfilePointIds];
  }
  const seedSegmentIndex =
    mode === SWEEP_MODE_ELEVATION
      ? await getSeedSegmentIndex(guide, profile, frames)
      : 0;

  let profileRefreshed = mode === SWEEP_MODE_IN_PLACE;
  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      // Hard delete: these rows belong to this annotation only.
      await db.points.bulkDelete(pointIdsToDelete);
      await db.points.bulkAdd([
        ...geometry.pointRecords,
        ...profilePointRecords,
      ]);
      await db.annotations.update(annotationId, {
        ...geometry.fields,
        profileLines,
      });
    });
    if (mode === SWEEP_MODE_ELEVATION) {
      const idx = await applyProfileFromAnnotationService({
        annotationId,
        sourceAnnotationId: sources.profileAnnotationId,
        seedSegmentIndex,
        invert: Boolean(prevLines[0]?.sourceInvert),
        mirror,
      });
      profileRefreshed = Number.isInteger(idx);
    }
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return { annotationId, mode, profileRefreshed };
}
