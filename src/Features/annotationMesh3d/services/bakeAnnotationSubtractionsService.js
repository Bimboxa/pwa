import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
} from "three";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import buildAnnotationSolidObjectsAsync from "Features/threedEditor/js/utilsAnnotationsManager/buildAnnotationSolidObjectsAsync";
import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import createBaseMapFrameGroup from "Features/threedEditor/js/utilsAnnotationsManager/createBaseMapFrameGroup";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import { getSolidMeshesFromObject3D } from "Features/threedEditor/js/utilsAnnotationsManager/getSolidMeshFromObject3D";
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

const CSG_SOURCE_MATERIAL = new MeshBasicMaterial();

// Below this volume change (m³) the targets did not touch the host.
const MIN_REMOVED_VOLUME_M3 = 1e-7;

// Whether the host's solid can be frozen into a mesh: a plain extrusion
// (convertible) or a mesh already. Generated shapes (revolutions, swept
// profiles, shells) are open surfaces or thousands of facets.
export function isAnnotationSubtractionBakeable(annotation) {
  if (!annotation?.id || isForeignFootprintId(annotation.id)) return false;
  if (annotation.isMesh3d) return true;
  return isAnnotationConvertibleToMesh3d(annotation);
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    try {
      child.userData?.dispose?.();
    } catch {
      /* ignore */
    }
    if (child.geometry) child.geometry.dispose();
    if (child.material && child.material !== CSG_SOURCE_MATERIAL) {
      child.material.dispose();
    }
  });
}

// Every solid mesh of the host, baked to WORLD space, as ONE mesh: a mesh
// host is built as one THREE.Mesh per face, and carving them one by one would
// close each face on its own (caps per face). Returns null without triangles.
function buildMergedWorldSolid(object) {
  const positions = [];
  for (const mesh of getSolidMeshesFromObject3D(object)) {
    const position = mesh.geometry?.getAttribute("position");
    if (!position) continue;
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    positions.push(...geometry.getAttribute("position").array);
    geometry.dispose();
  }
  if (positions.length < 9) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, CSG_SOURCE_MATERIAL);
  mesh.userData = { role: "SOLID" };
  mesh.updateMatrixWorld(true);
  return mesh;
}

// Signed volume of a closed triangle soup (divergence theorem), m³.
function getSoupVolume(geometry) {
  const p = geometry?.getAttribute?.("position");
  if (!p) return 0;
  let volume = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const ax = p.getX(i);
    const ay = p.getY(i);
    const az = p.getZ(i);
    const bx = p.getX(i + 1);
    const by = p.getY(i + 1);
    const bz = p.getZ(i + 1);
    const cx = p.getX(i + 2);
    const cy = p.getY(i + 2);
    const cz = p.getZ(i + 2);
    volume +=
      (ax * (by * cz - bz * cy) +
        ay * (bz * cx - bx * cz) +
        az * (bx * cy - by * cx)) /
      6;
  }
  return volume;
}

const toNonIndexedVolume = (geometry) => {
  if (!geometry) return 0;
  if (!geometry.index) return getSoupVolume(geometry);
  const soup = geometry.toNonIndexed();
  const volume = getSoupVolume(soup);
  soup.dispose();
  return volume;
};

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

  let hostObject = null;
  let solid = null;
  const frames = [];
  try {
    // 1. Host, in its base map frame.
    hostObject = createAnnotationObject3D(
      { ...host, _noAntiAliasingShrink: true },
      metrics,
      options
    );
    if (!hostObject) return refused(BAKE_SUBTRACTION_REASONS.NOT_BAKEABLE);
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
            { ...target, _noAntiAliasingShrink: true },
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

    // 3. One closed host brush, carved in world space.
    solid = buildMergedWorldSolid(hostObject);
    if (!solid) return refused(BAKE_SUBTRACTION_REASONS.NOT_BAKEABLE);
    const volumeBefore = Math.abs(getSoupVolume(solid.geometry));
    subtractAnnotationGeometries(solid, targetObjects);
    if (!solid.userData?.hasSubtraction) {
      return refused(BAKE_SUBTRACTION_REASONS.FAILED);
    }
    const volumeAfter = Math.abs(toNonIndexedVolume(solid.geometry));
    if (volumeBefore - volumeAfter < MIN_REMOVED_VOLUME_M3) {
      return refused(BAKE_SUBTRACTION_REASONS.NO_INTERSECTION);
    }

    // 4. Carved soup -> host base map LOCAL mesh (absolute z).
    const mesh = convertObject3DToMesh3d(solid, hostFrame, { carved: true });
    if (!mesh?.faces?.length || !isMesh3dClosed(mesh)) {
      return refused(BAKE_SUBTRACTION_REASONS.FAILED);
    }
    if (getMesh3dSignedVolume(mesh) <= 0) {
      return refused(BAKE_SUBTRACTION_REASONS.FAILED);
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
