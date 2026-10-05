import { Box3, Matrix4, Mesh, Raycaster, Vector2, Vector3 } from "three";

import {
  filterIntersectionsByClipping,
  getActiveClippingPlane,
  isWorldPointVisible,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { getFaceRegion } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import {
  filterIntersectionsByVisibility,
  isObjectChainVisible,
} from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import buildMeshDataFromRegion from "Features/threedMesh/utils/buildMeshDataFromRegion";
import {
  BRUSH_EDGE_PICK_PX,
  BRUSH_FACE_ANGLE_DEG,
  INSIDE_PROBE_M,
  MESH_PAINT_PART_TYPES,
} from "Features/meshPaint/constants/meshPaintConstants";
import {
  getHostHalfView,
  getHostPartData,
  getHostSolidMeshes,
} from "Features/meshPaint/js/buildHostPartIndexFromObject";
import { getMeshPaintObjects } from "Features/meshPaint/js/meshPaintObjectsStore";
import { probeNormalSide } from "Features/meshPaint/utils/buildHostPartIndex";
import {
  getClipKey,
  isSegmentDisplayed,
} from "Features/meshPaint/utils/clipPaintGeometry";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import getPaintHostRefusal, {
  PAINT_REFUSAL,
} from "Features/meshPaint/utils/getPaintHostRefusal";
import { localGeometryToPaint } from "Features/meshPaint/utils/meshPaintFrame";
import orientFaceTowardRay from "Features/meshPaint/utils/orientFaceTowardRay";
import pickFaceContainingPoint, {
  locatePointOnPlanarFace,
} from "Features/meshPaint/utils/pickFaceContainingPoint";
import { matchPaintPartToIndex } from "Features/meshPaint/utils/planPaintResync";

// Target picking of the « Pinceau » (MESH_BRUSH) in the 3D editor.
//
// pick(event, {partType, armedTemplateId, smoothAngleDeg}) →
//   { kind: "PAINT", paintId, partType, hostId, baseMapId, localGeometry,
//     previewKey }                       an existing paint (toggle / replace)
//   { kind: "HOST", partType, hostId, baseMapId, metrics, localGeometry,
//     candidate, previewKey }            a part of a host to paint
//   PAINT and HOST targets carry `clip` when the host is shown as a
//   display-only half revolution: the part covers the full turn, only its
//   displayed side is drawn and picked (clipPaintGeometry).
//   { kind: "REFUSED", reason, hostId?, previewKey }   (PAINT_REFUSAL key)
//   null                                 nothing under the cursor
//
// - Raycast recipe of the 3D tools (pickScene): explicit mesh targets (fat
//   lines, overlays, base map images, grid / scan decorations left out),
//   clipping- then visibility-filtered. The first annotation root or maille
//   hit decides; mailles are occluders (refused under the cursor).
// - Existing paints win (a paint is removable even when its host is hidden):
//   FACE paints are raycast explicitly (FrontSide skins: hit only from the
//   painted side), EDGE paints by screen distance.
// - FACE: plane-mode region of the hit triangle (getFaceRegion at
//   BRUSH_FACE_ANGLE_DEG) → planar islands (buildMeshDataFromRegion; a
//   region that is not planar enough falls back on the facets of the host
//   part index) → the island under the hit point → the side facing the
//   ray. On a closed host the inner side is refused (ray parity on the host's
//   solid triangles, 5 mm off the hit point). With smoothAngleDeg (the
//   « Sélection de face » angle), the facet grows into the smooth surface
//   around it (index.getSurfaces): a curved wall, a lathe, is ONE target.
// - EDGE: feature edges of the hosts near the cursor (the chains of the host
//   part index — T-junction repaired, merged into maximal straight edges,
//   with the facets they border — chained into planar curves while they turn
//   by less than smoothAngleDeg: index.getCurves), nearest on screen within
//   BRUSH_EDGE_PICK_PX, hidden ones (behind the surface under the cursor,
//   clipped) skipped; on a tie the host under the cursor wins.
//
// Geometry is converted to the base-map-LOCAL frame (group.worldToLocal) and
// to the stored form with the frame metrics of the base map
// (getMeshPaintMetrics: a base map without scale cannot be painted).

// A vertex / edge further than this (m) behind the surface under the cursor
// is hidden by it (computeSnapTarget's rule; absorbs the 1 mm lifts).
const OCCLUSION_EPS_M = 5e-3;
// A face paint wins over the surface hit when it is at most this much behind
// it (it is lifted 1 mm in front of its host).
const PAINT_FACE_WIN_M = 0.002;
// An edge paint wins over a host edge closer by at most this much.
const PAINT_EDGE_WIN_PX = 1.5;
// Screen-distance bonus of the host under the cursor (edge ties).
const HOST_HIT_TIE_PX = 1;
// Region polygons cache size (plane-mode regions of carved slabs are costly).
const REGION_CACHE_MAX = 64;
// Curved targets cache size (a stable target object per hovered surface:
// its stored form and its matches are computed once).
const SURFACE_CACHE_MAX = 8;
// A facet of the host part index holds the hit point within this plane
// distance (m).
const INDEX_FACET_TOL_M = 2e-3;

const FACE = MESH_PAINT_PART_TYPES.FACE;
const EDGE = MESH_PAINT_PART_TYPES.EDGE;

const refused = (reason, hostId = null) => ({
  kind: "REFUSED",
  reason,
  hostId,
  previewKey: `R:${reason}`,
});

const roundKey = (value) => Math.round(value * 1e6) / 1e6;

// base-map-local ↔ world helpers of a base map group.
function getFrame(group) {
  group.updateWorldMatrix(true, false);
  const inverse = new Matrix4().copy(group.matrixWorld).invert();
  const v = new Vector3();
  return {
    group,
    inverse,
    toLocal: (p) => {
      v.set(p.x, p.y, p.z).applyMatrix4(inverse);
      return { x: v.x, y: v.y, z: v.z };
    },
    dirToLocal: (d) => {
      v.set(d.x, d.y, d.z).transformDirection(inverse);
      return { x: v.x, y: v.y, z: v.z };
    },
    toWorld: (p) => new Vector3(p.x, p.y, p.z).applyMatrix4(group.matrixWorld),
  };
}

/**
 * Screen distance (px) from the cursor to a world segment, clipped by the
 * camera near plane, with the world point under the closest screen point
 * (perspective-correct, see findNearestEdgeSnap).
 */
export function getSegmentScreenHit(a, b, camera, rect, cursor) {
  const va = a.clone().applyMatrix4(camera.matrixWorldInverse);
  const vb = b.clone().applyMatrix4(camera.matrixWorldInverse);
  if (camera.isPerspectiveCamera) {
    const zNear = -(camera.near || 0.01) * 1.001;
    const aIn = va.z <= zNear;
    const bIn = vb.z <= zNear;
    if (!aIn && !bIn) return null;
    if (!aIn) va.lerp(vb, (zNear - va.z) / (vb.z - va.z));
    if (!bIn) vb.lerp(va, (zNear - vb.z) / (va.z - vb.z));
  }
  const wa = va.clone().applyMatrix4(camera.matrixWorld);
  const wb = vb.clone().applyMatrix4(camera.matrixWorld);
  const pa = wa.clone().project(camera);
  const pb = wb.clone().project(camera);
  if (pa.z > 1 && pb.z > 1) return null; // beyond the far plane
  const ax = ((pa.x + 1) / 2) * rect.width;
  const ay = ((1 - pa.y) / 2) * rect.height;
  const bx = ((pb.x + 1) / 2) * rect.width;
  const by = ((1 - pb.y) / 2) * rect.height;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-9) {
    t = ((cursor.x - ax) * dx + (cursor.y - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const distancePx = Math.hypot(ax + t * dx - cursor.x, ay + t * dy - cursor.y);
  // Clip-space w = view depth (perspective), 1 (orthographic).
  const wA = camera.isPerspectiveCamera ? -va.z : 1;
  const wB = camera.isPerspectiveCamera ? -vb.z : 1;
  const denom = (1 - t) * wB + t * wA;
  const s = Math.abs(denom) > 1e-12 ? (t * wA) / denom : t;
  return { distancePx, point: wa.clone().lerp(wb, s) };
}

// Screen rectangle of an object's world box contains the cursor (± margin).
// A box entirely behind the near plane is never near; one crossing it is
// (conservative).
function isBoxNearCursor(box, camera, rect, cursor, marginPx) {
  if (box.isEmpty()) return false;
  const corner = new Vector3();
  const near = camera.near || 0.01;
  const corners = [];
  let behind = 0;
  for (let i = 0; i < 8; i++) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z
    );
    const view = corner.clone().applyMatrix4(camera.matrixWorldInverse);
    if (camera.isPerspectiveCamera && view.z > -near) behind += 1;
    corners.push(corner.clone());
  }
  if (behind === 8) return false;
  if (behind > 0) return true;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of corners) {
    corner.copy(point).project(camera);
    const x = ((corner.x + 1) / 2) * rect.width;
    const y = ((1 - corner.y) / 2) * rect.height;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return (
    cursor.x >= minX - marginPx &&
    cursor.x <= maxX + marginPx &&
    cursor.y >= minY - marginPx &&
    cursor.y <= maxY + marginPx
  );
}

export function createMeshBrushPicker(sceneManager) {
  const raycaster = new Raycaster();
  const mouse = new Vector2();
  // `${geometry.uuid}:${regionId}:${mesh→group matrix}` → local faces |
  // {shell: true}
  const regionCache = new Map();
  // previewKey → curved FACE target
  const surfaceCache = new Map();
  // host part index → its facets as region faces
  const indexFacesCache = new WeakMap();
  const box = new Box3();

  function getManagers() {
    return {
      annotationsManager: sceneManager?.annotationsManager ?? null,
      imagesManager: sceneManager?.imagesManager ?? null,
    };
  }

  // First annotation root or maille along the cursor ray.
  function getSceneHit(clippingPlane) {
    const targets = [];
    sceneManager.scene.traverse((object) => {
      if (!object.isMesh || object.isLine2 || object.isLineSegments2) return;
      const userData = object.userData;
      if (
        userData?.isHoverOverlay ||
        userData?.isPaintOverlay ||
        userData?.isBasemap ||
        userData?.isGridPlaceholder ||
        userData?.isDecor
      ) {
        return;
      }
      targets.push(object);
    });
    const intersects = filterIntersectionsByVisibility(
      filterIntersectionsByClipping(
        raycaster.intersectObjects(targets, false),
        clippingPlane
      )
    );
    for (const intersect of intersects) {
      let object = intersect.object;
      while (object) {
        if (object.userData?.isMesh3d && object.userData?.mesh3dId) {
          return { kind: "MAILLE", intersect };
        }
        if (object.userData?.nodeType === "ANNOTATION") {
          return { kind: "HOST", intersect, root: object };
        }
        object = object.parent;
      }
    }
    return null;
  }

  // Plane of the surface under the cursor, facing the camera.
  function getOccluder(sceneHit) {
    const intersect = sceneHit?.intersect;
    if (!intersect?.face?.normal) return null;
    intersect.object.updateWorldMatrix(true, false);
    const normal = intersect.face.normal
      .clone()
      .transformDirection(intersect.object.matrixWorld);
    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
    return { point: intersect.point.clone(), normal };
  }

  function makeAccept(clippingPlane, occluder) {
    const offset = new Vector3();
    return (point) => {
      if (!isWorldPointVisible(clippingPlane, point)) return false;
      if (!occluder) return true;
      offset.copy(point).sub(occluder.point);
      return offset.dot(occluder.normal) >= -OCCLUSION_EPS_M;
    };
  }

  function paintTarget(object) {
    const userData = object.userData;
    return {
      kind: "PAINT",
      paintId: userData.meshPaintId,
      partType: userData.partType,
      hostId: userData.hostAnnotationId,
      baseMapId: userData.baseMapId,
      localGeometry: userData.localGeometry,
      clip: userData.clip ?? null,
      previewKey: `P:${userData.meshPaintId}:${getClipKey(userData.clip)}`,
    };
  }

  function getPickablePaints(partType) {
    const out = [];
    for (const object of getMeshPaintObjects().values()) {
      const userData = object?.userData;
      if (userData?.partType !== partType) continue;
      // Forced on screen by a panel highlight only: not a target.
      if (userData.visibility === "HIDDEN") continue;
      if (!isObjectChainVisible(object)) continue;
      out.push(object);
    }
    return out;
  }

  function pickPaintFace(clippingPlane) {
    const hits = [];
    for (const object of getPickablePaints(FACE)) {
      if (!object.isMesh) continue;
      object.updateWorldMatrix(true, false);
      // The paint's own raycast is disabled (generic pickers skip it).
      Mesh.prototype.raycast.call(object, raycaster, hits);
    }
    hits.sort((a, b) => a.distance - b.distance);
    return filterIntersectionsByClipping(hits, clippingPlane)[0] ?? null;
  }

  function pickPaintEdge({ camera, rect, cursor, accept }) {
    let best = null;
    for (const object of getPickablePaints(EDGE)) {
      const points = object.userData.localGeometry?.points ?? [];
      if (points.length < 2) continue;
      object.updateWorldMatrix(true, false);
      const world = points.map((p) =>
        new Vector3(p.x, p.y, p.z).applyMatrix4(object.matrixWorld)
      );
      // Every displayed segment (a curve has several).
      const clip = object.userData.clip ?? null;
      for (let i = 0; i + 1 < world.length; i++) {
        if (!isSegmentDisplayed(points[i], points[i + 1], clip)) continue;
        const hit = getSegmentScreenHit(
          world[i],
          world[i + 1],
          camera,
          rect,
          cursor
        );
        if (!hit || hit.distancePx > BRUSH_EDGE_PICK_PX) continue;
        if (!accept(hit.point)) continue;
        if (!best || hit.distancePx < best.distancePx) {
          best = { object, distancePx: hit.distancePx };
        }
      }
    }
    return best;
  }

  // Host context shared by the face and edge picks (null: not a host in its
  // base map frame).
  function getHostContext(root) {
    const { annotationsManager, imagesManager } = getManagers();
    const hostId = root?.userData?.nodeId;
    if (!hostId || !imagesManager) return null;
    const source = annotationsManager?.getAnnotationSource?.(hostId) ?? null;
    const baseMapId = root.userData.baseMapId ?? source?.baseMapId ?? null;
    const group = baseMapId ? imagesManager.getGroup?.(baseMapId) : null;
    const baseMap = baseMapId ? imagesManager.baseMapsMap?.[baseMapId] : null;
    return {
      hostId,
      root,
      source,
      baseMapId,
      group,
      baseMap,
      isUnderBaseMapGroup: Boolean(group) && root.parent === group,
    };
  }

  function getRegionLocalFaces(mesh, region, frame) {
    mesh.updateWorldMatrix(true, false);
    const relative = new Matrix4().multiplyMatrices(
      frame.inverse,
      mesh.matrixWorld
    );
    const key = `${mesh.geometry.uuid}:${region.regionId}:${relative.elements
      .map(roundKey)
      .join(",")}`;
    if (regionCache.has(key)) return regionCache.get(key);
    const data = buildMeshDataFromRegion(mesh, region.tris);
    let faces = null;
    if (data?.shell) {
      faces = { shell: true };
    } else if (data?.faces?.length) {
      faces = data.faces.map((face) => ({
        contour: face.contour.map(frame.toLocal),
        holes: (face.holes || []).map((hole) => hole.map(frame.toLocal)),
        normal: frame.dirToLocal(face.normal),
      }));
    }
    if (regionCache.size >= REGION_CACHE_MAX) {
      regionCache.delete(regionCache.keys().next().value);
    }
    regionCache.set(key, faces);
    return faces;
  }

  // Facets of the host part index as region faces (same local frame).
  function getIndexFaces(index) {
    let faces = indexFacesCache.get(index);
    if (!faces) {
      faces = index.islands.flatMap((island) =>
        island.polygons.map((polygon) => ({
          contour: polygon.contour,
          holes: polygon.holes,
          normal: island.normal,
        }))
      );
      indexFacesCache.set(index, faces);
    }
    return faces;
  }

  function pickHostFace(sceneHit, armedTemplateId, smoothAngleDeg) {
    const host = getHostContext(sceneHit.root);
    if (!host) return null;
    const refusal = getPaintHostRefusal({
      source: host.source,
      rootUserData: host.root.userData,
      isUnderBaseMapGroup: host.isUnderBaseMapGroup,
      armedTemplateId,
    });
    if (refusal) return refused(refusal, host.hostId);

    const { intersect } = sceneHit;
    const mesh = intersect.object;
    if (!getHostSolidMeshes(host.root).includes(mesh)) {
      return refused(PAINT_REFUSAL.NOT_SOLID, host.hostId);
    }
    const metrics = getMeshPaintMetrics(host.baseMap);
    if (!metrics) return refused(PAINT_REFUSAL.NO_SCALE, host.hostId);

    const region = getFaceRegion(mesh.geometry, intersect.faceIndex, {
      plane: true,
      angleDeg: BRUSH_FACE_ANGLE_DEG,
    });
    if (!region) return null;
    const frame = getFrame(host.group);
    let faces = getRegionLocalFaces(mesh, region, frame);
    if (!faces) return null;
    const data = getHostPartData({
      root: host.root,
      group: host.group,
      source: host.source,
      baseMap: host.baseMap,
    });
    const index = data?.getIndex() ?? null;

    const hitLocal = frame.toLocal(intersect.point);
    // Not planar enough for the region builder: the facets of the index.
    const fromIndex = Boolean(faces.shell);
    if (fromIndex) faces = index ? getIndexFaces(index) : [];
    const islandIndex = pickFaceContainingPoint(faces, hitLocal);
    const island = faces[islandIndex];
    if (
      fromIndex &&
      !(
        locatePointOnPlanarFace(island, hitLocal)?.planeDist <=
        INDEX_FACET_TOL_M
      )
    ) {
      return refused(PAINT_REFUSAL.CURVED_SURFACE, host.hostId);
    }
    if (!island) return null;
    const localFace = orientFaceTowardRay(
      {
        polygons: [{ contour: island.contour, holes: island.holes }],
        normal: island.normal,
      },
      frame.dirToLocal(raycaster.ray.direction)
    );
    const n = localFace.normal;
    const side =
      n.x * island.normal.x + n.y * island.normal.y + n.z * island.normal.z >= 0
        ? "+"
        : "-";

    // Inner side of a closed solid (seen through a clipping cut, from
    // inside a hollow): refused. Open sheets keep both sides.
    if (index?.isClosed) {
      // Both sides probed (a thin solid would fool a single 5 mm probe).
      const side = probeNormalSide(hitLocal, n, data.isInside);
      const inner =
        side < 0 ||
        (side === 0 &&
          data.isInside({
            x: hitLocal.x + n.x * INSIDE_PROBE_M,
            y: hitLocal.y + n.y * INSIDE_PROBE_M,
            z: hitLocal.z + n.z * INSIDE_PROBE_M,
          }));
      if (inner) return refused(PAINT_REFUSAL.INNER_FACE, host.hostId);
    }

    const clip = getHostHalfView(host.root, host.group);
    const toTarget = (localGeometry, previewKey) => ({
      kind: "HOST",
      partType: FACE,
      hostId: host.hostId,
      baseMapId: host.baseMapId,
      metrics,
      localGeometry,
      clip,
      candidate: {
        partType: FACE,
        hostAnnotationId: host.hostId,
        baseMapId: host.baseMapId,
        geometry: localGeometryToPaint(FACE, localGeometry, metrics),
        geomHash: null,
      },
      previewKey,
    });

    // The smooth surface around the facet (a curved wall, a lathe).
    if (index && smoothAngleDeg > BRUSH_FACE_ANGLE_DEG) {
      const grown = matchPaintPartToIndex(FACE, localFace, index, {
        allowFar: false,
        smoothAngleDeg,
      });
      if (grown?.surfaceKey) {
        const key = `S:${host.hostId}:${data.hash}:${smoothAngleDeg}:${
          grown.surfaceKey
        }:${getClipKey(clip)}`;
        let target = surfaceCache.get(key);
        if (!target) {
          target = toTarget(grown.geometry, key);
          if (surfaceCache.size >= SURFACE_CACHE_MAX) {
            surfaceCache.delete(surfaceCache.keys().next().value);
          }
          surfaceCache.set(key, target);
        }
        return target;
      }
    }

    return toTarget(
      localFace,
      `F:${host.hostId}:${mesh.geometry.uuid}:${region.regionId}:${islandIndex}:${side}`
    );
  }

  function pickHostEdge({
    sceneHit,
    armedTemplateId,
    smoothAngleDeg,
    camera,
    rect,
    cursor,
    accept,
  }) {
    const { annotationsManager } = getManagers();
    const roots = annotationsManager?.annotationsObjectsMap ?? {};
    const hostHitRoot = sceneHit?.kind === "HOST" ? sceneHit.root : null;
    let best = null;
    let hostHitRefusal = null;

    for (const root of Object.values(roots)) {
      if (!root?.parent || !isObjectChainVisible(root)) continue;
      const host = getHostContext(root);
      if (!host?.isUnderBaseMapGroup) continue;
      box.setFromObject(root);
      if (!isBoxNearCursor(box, camera, rect, cursor, BRUSH_EDGE_PICK_PX)) {
        continue;
      }
      const refusal = getPaintHostRefusal({
        source: host.source,
        rootUserData: root.userData,
        armedTemplateId,
      });
      if (refusal) {
        if (root === hostHitRoot) hostHitRefusal = refusal;
        continue;
      }
      const data = getHostPartData({
        root,
        group: host.group,
        source: host.source,
        baseMap: host.baseMap,
      });
      const curves = data?.getIndex().getCurves(smoothAngleDeg).curves ?? [];
      if (!curves.length) continue;
      const frame = getFrame(host.group);
      const isHostHit = root === hostHitRoot;
      const clip = getHostHalfView(root, host.group);
      curves.forEach((curve, curveIndex) => {
        // Every displayed segment (a straight edge has one).
        let from = frame.toWorld(curve.points[0]);
        for (let i = 1; i < curve.points.length; i++) {
          const to = frame.toWorld(curve.points[i]);
          const displayed = isSegmentDisplayed(
            curve.points[i - 1],
            curve.points[i],
            clip
          );
          const hit = displayed
            ? getSegmentScreenHit(from, to, camera, rect, cursor)
            : null;
          from = to;
          if (!hit || hit.distancePx > BRUSH_EDGE_PICK_PX) continue;
          if (!accept(hit.point)) continue;
          const score = hit.distancePx - (isHostHit ? HOST_HIT_TIE_PX : 0);
          if (!best || score < best.score) {
            best = {
              score,
              distancePx: hit.distancePx,
              host,
              data,
              curve,
              curveIndex,
              smoothAngleDeg,
              clip,
            };
          }
        }
      });
    }
    return { best, hostHitRefusal };
  }

  function edgeTarget(best) {
    const { host, data, curve, curveIndex, smoothAngleDeg, clip } = best;
    const metrics = getMeshPaintMetrics(host.baseMap);
    if (!metrics) return refused(PAINT_REFUSAL.NO_SCALE, host.hostId);
    const localGeometry = { points: [...curve.points] };
    if (curve.sides?.length) localGeometry.sides = curve.sides;
    // A curve remembers the angle it was chained with (the re-sync chains
    // the host's edges again with the same one).
    const isCurve = curve.points.length > 2;
    if (isCurve) localGeometry.angleDeg = smoothAngleDeg;
    return {
      kind: "HOST",
      partType: EDGE,
      hostId: host.hostId,
      baseMapId: host.baseMapId,
      metrics,
      localGeometry,
      clip,
      candidate: {
        partType: EDGE,
        hostAnnotationId: host.hostId,
        baseMapId: host.baseMapId,
        geometry: localGeometryToPaint(EDGE, localGeometry, metrics),
        geomHash: null,
      },
      previewKey: `E:${host.hostId}:${data.hash}:${
        isCurve ? smoothAngleDeg : 0
      }:${curveIndex}:${getClipKey(clip)}`,
    };
  }

  /**
   * @param {{clientX: number, clientY: number}} event
   * @param {{partType: "FACE"|"EDGE", armedTemplateId: string|null,
   *   smoothAngleDeg?: number}} options - smoothAngleDeg: neighbors folding
   *   (facets) / turning (edges) by less are one surface / one curve; 0 =
   *   planar facets and straight edges only.
   */
  function pick(
    event,
    { partType, armedTemplateId = null, smoothAngleDeg = 0 } = {}
  ) {
    const smoothAngle = Math.max(0, Number(smoothAngleDeg) || 0);
    const camera = sceneManager?.camera;
    const dom = sceneManager?.renderer?.domElement;
    if (!camera || !dom || !sceneManager.scene || !event) return null;
    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const clippingPlane = getActiveClippingPlane(sceneManager);
    const sceneHit = getSceneHit(clippingPlane);

    if (partType === FACE) {
      const paintHit = pickPaintFace(clippingPlane);
      if (
        paintHit &&
        paintHit.distance <=
          (sceneHit?.intersect.distance ?? Infinity) + PAINT_FACE_WIN_M
      ) {
        return paintTarget(paintHit.object);
      }
      if (!sceneHit) return null;
      if (sceneHit.kind === "MAILLE") return refused(PAINT_REFUSAL.OCCLUDED);
      return pickHostFace(sceneHit, armedTemplateId, smoothAngle);
    }

    if (partType !== EDGE) return null;
    const cursor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const accept = makeAccept(clippingPlane, getOccluder(sceneHit));
    const screen = { camera, rect, cursor, accept };
    const paintEdge = pickPaintEdge(screen);
    const { best, hostHitRefusal } = pickHostEdge({
      ...screen,
      sceneHit,
      armedTemplateId,
      smoothAngleDeg: smoothAngle,
    });
    if (
      paintEdge &&
      (!best || paintEdge.distancePx <= best.distancePx + PAINT_EDGE_WIN_PX)
    ) {
      return paintTarget(paintEdge.object);
    }
    if (best) return edgeTarget(best);
    if (hostHitRefusal) return refused(hostHitRefusal);
    return null;
  }

  return { pick };
}
