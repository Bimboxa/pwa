import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import applyProfileFromAnnotationService from "Features/elevation/services/applyProfileFromAnnotationService";

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
//     segment. A profile drawn flat on the plan gives a flat band. Requires the
//     profile and the guide on the same base map.
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
  BASE_MAP_MISMATCH:
    "Sans point de référence, le profil doit être sur le même fond de plan que le guide.",
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

// Independent copy of the guide's main ring: new db.points at the same
// normalized coords, refs keeping their per-vertex props (type, offsets) and
// the hidden-segment flags remapped to the new ids.
async function copyGuideGeometry(guide, { projectId, listingId }) {
  const ring = await readRing(guide.points);
  if (ring.length < 2) return null;

  const idMap = new Map();
  const pointRecords = [];
  const points = ring.map(({ ref, row }) => {
    let newId = idMap.get(ref.id);
    if (!newId) {
      newId = nanoid();
      idMap.set(ref.id, newId);
      pointRecords.push({
        id: newId,
        x: row.x,
        y: row.y,
        projectId,
        baseMapId: guide.baseMapId,
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

// IN_PLACE profile line: the profile's own plan vertices, heights = vertex
// altitude relative to the result's offsetZ (inline heights are absolute,
// the 3D build lifts the sweep by the result's offsetZ).
async function buildInPlaceProfileLine(
  profile,
  { resultOffsetZ, projectId, baseMapId, listingId }
) {
  const ring = await readRing(profile.points);
  if (ring.length < 2) return null;
  const lift = _num(profile.offsetZ) - _num(resultOffsetZ);
  const pointRecords = [];
  const points = ring.map(({ ref, row }) => {
    const id = nanoid();
    pointRecords.push({
      id,
      x: row.x,
      y: row.y,
      projectId,
      baseMapId,
      listingId: listingId ?? null,
    });
    return {
      pointId: id,
      type: ref.type === "circle" ? "circle" : "square",
      height: lift + _num(ref.offsetBottom),
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

// ELEVATION registration: the guide segment nearest (in plan) to the
// profile's base point, when both live on the same base map; else 0.
async function getSeedSegmentIndex(guide, profile) {
  if (profile.baseMapId !== guide.baseMapId) return 0;
  const baseRef = (profile.points ?? []).find((r) => r?.isBasePoint);
  if (!baseRef?.id) return 0;
  const baseRow = await db.points.get(baseRef.id);
  if (!Number.isFinite(baseRow?.x) || !Number.isFinite(baseRow?.y)) return 0;
  const baseMap = await db.baseMaps.get(guide.baseMapId);
  const w = baseMap?.image?.imageSize?.width || 1;
  const h = baseMap?.image?.imageSize?.height || 1;
  const ring = await readRing(guide.points);
  const pts = ring.map(({ row }) => ({ x: row.x * w, y: row.y * h }));
  const n = pts.length;
  if (n < 2) return 0;
  const closed = guide.type === "POLYGON" || Boolean(guide.closeLine);
  const segCount = closed ? n : n - 1;
  const P = { x: baseRow.x * w, y: baseRow.y * h };
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
// when templateless), forced to a POLYLINE on the guide's base map.
async function buildResultProps(profile, guide) {
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
    baseMapId: guide.baseMapId,
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

// Creates the swept annotation. Resolves to { annotationId, mode } or
// { error } (a key of SWEEP_ERROR_MESSAGES).
export async function createSweepAlongLineService({
  profileAnnotationId,
  guideAnnotationId,
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
  if (mode === SWEEP_MODE_IN_PLACE && profile.baseMapId !== guide.baseMapId) {
    return { error: "BASE_MAP_MISMATCH" };
  }

  const props = await buildResultProps(profile, guide);
  const geometry = await copyGuideGeometry(guide, {
    projectId: guide.projectId,
    listingId: props.listingId,
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
      baseMapId: guide.baseMapId,
      listingId: props.listingId,
    });
    if (!built) return { error: "PROFILE_GEOMETRY" };
    annotation.profileLines = [built.line];
    profilePointRecords = built.pointRecords;
  }
  const seedSegmentIndex =
    mode === SWEEP_MODE_ELEVATION
      ? await getSeedSegmentIndex(guide, profile)
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

// Rebuilds a swept annotation from its sources: the guide's ring is copied
// again and the profile re-applied (same registration rule). A deleted
// profile keeps the current profile line (the ring alone is refreshed).
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
  if (mode === SWEEP_MODE_IN_PLACE && profile.baseMapId !== guide.baseMapId) {
    return { error: "BASE_MAP_MISMATCH" };
  }

  const geometry = await copyGuideGeometry(guide, {
    projectId: ann.projectId,
    listingId: ann.listingId,
  });
  if (!geometry) return { error: "GUIDE_GEOMETRY" };

  const prevLines = Array.isArray(ann.profileLines) ? ann.profileLines : [];
  const prevProfilePointIds = prevLines.flatMap((l) =>
    (l?.points ?? []).map((r) => r?.pointId).filter(Boolean)
  );
  const ringPointIds = (ann.points ?? []).map((r) => r?.id).filter(Boolean);

  let profileLines = prevLines;
  let profilePointRecords = [];
  let pointIdsToDelete = ringPointIds;
  if (mode === SWEEP_MODE_IN_PLACE) {
    const built = await buildInPlaceProfileLine(profile, {
      resultOffsetZ: ann.offsetZ,
      projectId: ann.projectId,
      baseMapId: ann.baseMapId,
      listingId: ann.listingId,
    });
    if (!built) return { error: "PROFILE_GEOMETRY" };
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
      ? await getSeedSegmentIndex(guide, profile)
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
      });
      profileRefreshed = Number.isInteger(idx);
    }
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return { annotationId, mode, profileRefreshed };
}
