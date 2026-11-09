import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import isInlineExtrusionPolyline from "Features/annotations/utils/isInlineExtrusionPolyline";
import isPolylineSheetWall from "Features/annotations/utils/isPolylineSheetWall";
import {
  getShape3DKey,
  isRevolutionSolid,
} from "Features/annotations/constants/shape3DConfig";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import buildAnnotationSolidObjectsAsync from "Features/threedEditor/js/utilsAnnotationsManager/buildAnnotationSolidObjectsAsync";
import buildMergedWorldSolid, {
  MERGED_SOLID_MATERIAL,
} from "Features/threedEditor/js/utilsAnnotationsManager/buildMergedWorldSolid";
import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import createBaseMapFrameGroup from "Features/threedEditor/js/utilsAnnotationsManager/createBaseMapFrameGroup";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import {
  getSoupArea,
  getSoupVolume,
  toNonIndexedArea,
  toNonIndexedVolume,
} from "Features/threedEditor/js/utilsAnnotationsManager/getSoupMeasures";
import subtractAnnotationGeometries from "Features/threedEditor/js/utilsAnnotationsManager/subtractAnnotationGeometries";

import { getMesh3dSignedVolume } from "../utils/getMesh3dQties";
import isAnnotationConvertibleToMesh3d from "../utils/isAnnotationConvertibleToMesh3d";
import isMesh3dClosed from "../utils/isMesh3dClosed";
import convertObject3DToMesh3d from "./convertObject3DToMesh3d";
import writeMesh3dService from "./writeMesh3dService";

// « Soustraire définitivement »: carves the subtraction targets out of the
// host for good. The 3D boolean that AnnotationsManager replays at every
// build (relAnnotationSubtractions) is run once, headlessly, and its result
// is written as the host's mesh (writeMesh3dService: the host becomes a
// POLYGON isMesh3d annotation, its first conversion keeps the original 2D
// geometry in mesh3dSource for « Réinitialiser »). The cutters are kept; only
// the host → target relations that were baked are deleted. ONE undo step
// (the host row and the relations come back together).
//
// host / targets: RESOLVED annotations (pixel points, template fields
// applied — useAnnotationsV2 output, or AnnotationsManager's build source).
// A target may live on another base map: it is built with its own metrics
// and posed in its own base map frame (`_baseMapForRender` /
// `_baseMapTransform` when useAnnotationsV2 attached them, else from
// baseMapsById), like the live carve.
// baseMapsById: { [id]: base map record or BaseMap instance }.
// buildOptions: the 3D build options (AnnotationsManager.getBuildOptions())
// when known; the anti-aliasing tweaks are always turned off — the inset of
// « Séparer les surfaces en contact » must never be baked in a written mesh.
//
// Returns { status: "done", annotation } | { status: "refused", reason }.

export const BAKE_SUBTRACTION_REASONS = {
  NOT_FOUND: "NOT_FOUND",
  NOT_BAKEABLE: "NOT_BAKEABLE",
  NO_TARGET: "NO_TARGET",
  NO_INTERSECTION: "NO_INTERSECTION",
  FAILED: "FAILED",
};

const refused = (reason) => ({ status: "refused", reason });

// Below this volume change (m³) the targets did not touch the host.
const MIN_REMOVED_VOLUME_M3 = 1e-7;
// Same for an OPEN host (a lathe shell): the carve removes surface, not
// volume (m²).
const MIN_REMOVED_AREA_M2 = 1e-6;

// A lathe is 64 quads per profile segment (a sampled arc = 24 segments), and
// an inline-extrusion sheet one quad per guide sample × profile segment (arcs
// sampled on both) — far beyond the hand-editing cap of
// convertObject3DToMesh3d; a baked generated shape is a frozen shape, not a
// mesh to edit face by face.
const BAKE_MAX_FACES_GENERATED = 8000;

// A REVOLUTION host (profile revolved around a REVOLUTION_AXIS) with its
// axis resolved (`revolutionAxisPoints`, useAnnotationsV2 /
// AnnotationsManager.getAnnotationSource). Without the axis
// createAnnotationObject3D falls back to the plain polyline wall, which
// must never be baked in its place.
export function isRevolutionBakeHost(annotation) {
  return (
    annotation?.type === "POLYLINE" &&
    getShape3DKey(annotation.shape3D) === "REVOLUTION" &&
    annotation.revolutionAxisPoints?.length >= 2 &&
    !annotation.isOpening &&
    !annotation.isMeshCell
  );
}

// Whether the host's solid can be frozen into a mesh: a plain extrusion
// (convertible), a mesh already, a revolution (closed « Solide » volume, or
// open lathe shell baked as an open mesh), or an inline-extrusion sheet
// (POLYLINE + profileLines, baked as an open mesh too). A plain PX polyline
// wall is convertible, but it is a zero-thickness sheet as well: the bake
// clips it as a surface (isPolylineSheetWall). The other generated shapes
// (POLYGON shells) stay out.
// isAnnotationConvertibleToMesh3d itself is NOT widened: push/pull and the
// face cuts keep refusing these generated shapes.
export function isAnnotationSubtractionBakeable(annotation) {
  if (!annotation?.id || isForeignFootprintId(annotation.id)) return false;
  if (annotation.isMesh3d) return true;
  if (isRevolutionBakeHost(annotation)) return true;
  if (isInlineExtrusionPolyline(annotation)) return true;
  return isAnnotationConvertibleToMesh3d(annotation);
}

// A REVOLUTION cutter is baked as its CLOSED volume (profile closed toward
// the axis, capped) whatever its « Solide » switch: an open lathe shell makes
// the boolean ill-defined — three-bvh-csg classifies the host triangles by
// ray parity against a surface that does not bound a volume, and the result
// is not watertight (the host's bottom cap goes missing), which the closure
// checks below refuse. Validated by a headless replay on a user case: same
// removed volume to 1 % (2.00 vs 2.01 m³), closed result. The live carve
// (AnnotationsManager) keeps the shell as drawn. A degenerate closed contour
// falls back to the open shell inside buildRevolutionMesh.
function asClosedCutter(target) {
  if (getShape3DKey(target?.shape3D) !== "REVOLUTION") return target;
  return { ...target, shape3D: { ...target.shape3D, solid: true } };
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    try {
      child.userData?.dispose?.();
    } catch {
      /* ignore */
    }
    if (child.geometry) child.geometry.dispose();
    if (child.material && child.material !== MERGED_SOLID_MATERIAL) {
      child.material.dispose();
    }
  });
}

export default async function bakeAnnotationSubtractionsService({
  host,
  targets,
  baseMapsById,
  buildOptions,
  dispatch,
}) {
  if (!host?.id) return refused(BAKE_SUBTRACTION_REASONS.NOT_FOUND);
  if (!isAnnotationSubtractionBakeable(host)) {
    return refused(BAKE_SUBTRACTION_REASONS.NOT_BAKEABLE);
  }
  const validTargets = (targets ?? []).filter(
    (t) => t?.id && t.id !== host.id && !isForeignFootprintId(t.id)
  );
  if (!validTargets.length) return refused(BAKE_SUBTRACTION_REASONS.NO_TARGET);

  const row = await db.annotations.get(host.id);
  if (!row || row.deletedAt) return refused(BAKE_SUBTRACTION_REASONS.NOT_FOUND);

  const getBaseMap = (id) =>
    baseMapsById instanceof Map ? baseMapsById.get(id) : baseMapsById?.[id];
  const hostBaseMap = getBaseMap(host.baseMapId);
  const metrics = getBaseMapForRender(hostBaseMap);
  if (!metrics) return refused(BAKE_SUBTRACTION_REASONS.NOT_FOUND);

  // No render-only tweak (footprint shrink, « Delta offset 3D » lift).
  const options = { ...(buildOptions ?? {}), antiAliasingShrink: false };
  // Nor the camera-driven 180° half-view of a revolution (display only, it
  // would bake half a lathe — same stripping as buildAnnotationSolidObjectsAsync
  // for the operands). The axis's own partial sector (`revolutionPhi`) stays:
  // it is part of the annotation.
  const hostOptions = {
    ...options,
    revolutionSection: undefined,
    revolutionSectionByAxisId: undefined,
    revolutionSectionFill: false,
  };
  const isRevolutionHost = isRevolutionBakeHost(host);
  const isInlineExtrusionHost = isInlineExtrusionPolyline(host);
  const isSheetWallHost = isPolylineSheetWall(host);
  // An open lathe shell, an inline-extrusion sheet, a PX polyline wall (one
  // zero-thickness quad per segment), or an open mesh host (a flat sheet
  // drawn in 3D), is clipped (HOLLOW_SUBTRACTION, no cap faces) and written
  // as an OPEN mesh; a « Solide » revolution or a closed mesh is a closed
  // volume like any extrusion — the rule of the live carve
  // (AnnotationsManager). Carved as a solid, a sheet never reads as a closed
  // mesh and the bake was refused (FAILED).
  const hollow = host.isMesh3d
    ? !isMesh3dClosed(host.mesh3d)
    : (isRevolutionHost && !isRevolutionSolid(host)) ||
      isInlineExtrusionHost ||
      isSheetWallHost;

  let hostObject = null;
  let solid = null;
  const frames = [];
  try {
    // 1. Host, in its base map frame.
    hostObject = createAnnotationObject3D(
      { ...host, _noAntiAliasingShrink: true },
      metrics,
      hostOptions
    );
    if (!hostObject) return refused(BAKE_SUBTRACTION_REASONS.NOT_BAKEABLE);
    // A degenerate inline profile makes createAnnotationObject3D fall back to
    // the plain polyline wall (a closed solid): never freeze that wall in the
    // sheet's place.
    if (isInlineExtrusionHost && !hostObject.userData?.inlineExtrusion) {
      console.warn(
        `[bakeAnnotationSubtractionsService] ${host.id}: the inline profile did not build a swept surface (degenerate setup)`
      );
      return refused(BAKE_SUBTRACTION_REASONS.NOT_BAKEABLE);
    }
    const hostFrame = createBaseMapFrameGroup(getBaseMapTransform(hostBaseMap));
    hostFrame.add(hostObject);
    frames.push(hostFrame);
    hostFrame.updateMatrixWorld(true);

    // 2. Targets, each in ITS OWN base map frame (cross-baseMap carve).
    const targetObjects = (
      await Promise.all(
        validTargets.map(async (target) => {
          const targetBaseMap = getBaseMap(target.baseMapId) ?? hostBaseMap;
          const forRender =
            target._baseMapForRender ??
            getBaseMapForRender(targetBaseMap) ??
            metrics;
          const transform =
            target._baseMapTransform ?? getBaseMapTransform(targetBaseMap);
          const objects = await buildAnnotationSolidObjectsAsync(
            { ...asClosedCutter(target), _noAntiAliasingShrink: true },
            forRender,
            options
          );
          return (objects ?? []).filter(Boolean).map((object) => {
            const frame = createBaseMapFrameGroup(transform);
            frame.add(object);
            frame.updateMatrixWorld(true);
            frames.push(frame);
            return object;
          });
        })
      )
    ).flat();
    if (!targetObjects.length) {
      return refused(BAKE_SUBTRACTION_REASONS.NO_TARGET);
    }

    // 3. One host brush (closed solid, or open shell), carved in world space
    // (buildMergedWorldSolid: a mesh host is one Mesh per face, merged).
    solid = buildMergedWorldSolid(hostObject);
    if (!solid) return refused(BAKE_SUBTRACTION_REASONS.NOT_BAKEABLE);
    const measureBefore = hollow
      ? getSoupArea(solid.geometry)
      : Math.abs(getSoupVolume(solid.geometry));
    subtractAnnotationGeometries(solid, targetObjects, { hollow });
    if (!solid.userData?.hasSubtraction) {
      console.warn(
        `[bakeAnnotationSubtractionsService] ${host.id}: the CSG subtraction produced no geometry`
      );
      return refused(BAKE_SUBTRACTION_REASONS.FAILED);
    }
    const measureAfter = hollow
      ? toNonIndexedArea(solid.geometry)
      : Math.abs(toNonIndexedVolume(solid.geometry));
    const minRemoved = hollow ? MIN_REMOVED_AREA_M2 : MIN_REMOVED_VOLUME_M3;
    if (measureBefore - measureAfter < minRemoved) {
      return refused(BAKE_SUBTRACTION_REASONS.NO_INTERSECTION);
    }

    // 4. Carved soup -> host base map LOCAL mesh (absolute z). An open shell
    // is kept as it is (DoubleSide render, surface = face areas, no volume).
    const mesh = convertObject3DToMesh3d(solid, hostFrame, {
      carved: true,
      allowOpen: hollow,
      maxFaces:
        isRevolutionHost || isInlineExtrusionHost
          ? BAKE_MAX_FACES_GENERATED
          : undefined,
    });
    if (!mesh?.faces?.length) {
      console.warn(
        `[bakeAnnotationSubtractionsService] ${host.id}: the carved soup could not be read as a face mesh (open result, or more faces than the cap)`
      );
      return refused(BAKE_SUBTRACTION_REASONS.FAILED);
    }
    if (!hollow) {
      if (!isMesh3dClosed(mesh)) {
        console.warn(
          `[bakeAnnotationSubtractionsService] ${host.id}: the carved mesh is not closed (an open cutter?)`
        );
        return refused(BAKE_SUBTRACTION_REASONS.FAILED);
      }
      if (getMesh3dSignedVolume(mesh) <= 0) {
        console.warn(
          `[bakeAnnotationSubtractionsService] ${host.id}: the carved mesh has no positive volume`
        );
        return refused(BAKE_SUBTRACTION_REASONS.FAILED);
      }
    }

    // 5. One undo step: the host mesh + the baked relations.
    const targetIds = new Set(validTargets.map((t) => t.id));
    let written = null;
    await withUndoGroup(async () => {
      written = await writeMesh3dService({
        annotation: row,
        mesh,
        baseOffsetZ: 0,
        metrics,
        dispatch,
      });
      if (!written) return;
      const rels = await db.relAnnotationSubtractions
        .where("sourceAnnotationId")
        .equals(host.id)
        .toArray();
      const relIds = rels
        .filter((r) => !r.deletedAt && targetIds.has(r.targetAnnotationId))
        .map((r) => r.id);
      if (relIds.length) await db.relAnnotationSubtractions.bulkDelete(relIds);
    });
    if (!written) return refused(BAKE_SUBTRACTION_REASONS.FAILED);
    return { status: "done", annotation: written };
  } catch (e) {
    console.error("[bakeAnnotationSubtractionsService] failed", e);
    return refused(BAKE_SUBTRACTION_REASONS.FAILED);
  } finally {
    disposeObject(solid);
    frames.forEach((frame) => disposeObject(frame));
  }
}

export function getBakeSubtractionMessage(reason) {
  switch (reason) {
    case BAKE_SUBTRACTION_REASONS.NOT_BAKEABLE:
      return "Cette annotation ne peut pas être soustraite définitivement";
    case BAKE_SUBTRACTION_REASONS.NO_INTERSECTION:
      return "Les annotations ne se recoupent pas";
    case BAKE_SUBTRACTION_REASONS.NO_TARGET:
      return "Aucune annotation à soustraire";
    case BAKE_SUBTRACTION_REASONS.NOT_FOUND:
      return "Annotation introuvable";
    default:
      return "Soustraction définitive impossible";
  }
}
