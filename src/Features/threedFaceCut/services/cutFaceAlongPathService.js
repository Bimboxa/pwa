import { nanoid } from "@reduxjs/toolkit";
import { Box3, Vector3 } from "three";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import getEditableMesh3d, {
  worldToMesh3dLocal,
} from "Features/annotationMesh3d/services/getEditableMesh3d";
import writeMesh3dService from "Features/annotationMesh3d/services/writeMesh3dService";
import {
  localToNormalized,
  normalizedToLocal,
} from "Features/annotationMesh3d/utils/mesh3dFrame";
import locatePathOnMesh3d from "Features/annotationMesh3d/utils/locatePathOnMesh3d";
import {
  classifyPointOnFace,
  getFace2d,
} from "Features/annotationMesh3d/utils/mesh3dFace2d";
import {
  getDistanceToFacePlane,
  getFaceNormal,
} from "Features/annotationMesh3d/utils/mesh3dTopology";
import { splitMesh3dFaceDetailed } from "Features/annotationMesh3d/utils/splitMesh3dFace";
import splitPolylineAtVertex from "Features/mapEditor/utils/splitPolylineAtVertex";
import { copyMeshPaintsForSplit } from "Features/meshPaint/services/copyMeshPaintsService";
import { isObjectChainVisible } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import { projectPointTo2d } from "Features/threedMesh/utils/planeProjection";

import fitPlanarValue from "../utils/fitPlanarValue";
import locatePlanPointOnPolyline from "../utils/locatePlanPointOnPolyline";
import snapPathOntoMesh3dFace from "../utils/snapPathOntoMesh3dFace";
import splitRing2dByPath, {
  locateInnerLoopInRing,
} from "../utils/splitRing2dByPath";

// Slack (m) of the "the path lies within this mesh annotation" box test.
const BOX_TOL_M = 5e-3;

// Plan tolerance (m): a cut end on the outline, a vertical cut on a wall.
const PLAN_TOL_M = 1e-2;

// Face normal (base-map-local, z = up from the plan) of a polygon's plan face
// (top / bottom, sloped included) vs a wall's vertical face.
const PLAN_FACE_MIN_NORMAL_Z = 0.1;
const VERTICAL_FACE_MAX_NORMAL_Z = 0.05;

// "Coupe face" tool (3D editor): cuts in two the face a path is drawn on —
// the face of any annotation, selected or not.
//
// A regular annotation stays regular whenever the cut has a plan encoding:
// - a POLYGON cut on its plan face (top / bottom) → two polygons (a loop
//   drawn inside → a hole + the inner polygon);
// - a wall (POLYLINE) cut vertically on its side → two walls (a closed wall
//   is opened there).
// Otherwise — another face, a host of openings / subtractions, a mesh
// annotation — the annotation's mesh is split (converted to a mesh first).
//
// vertices: drawn world points [{x, y, z, nodeId?}]; closed: the path loops
// back to its first point. Returns { kind: "POLYGON_2D" | "WALL_2D" | "MESH",
// annotationId } once cut, { kind: "FAILED" } when the cut could not be
// written, or { kind: "NONE", reason } when the path cuts no face — reason
// (most telling one over the candidates, each logged):
//   NO_ANNOTATION     the path lies on no annotation
//   NOT_EDITABLE      its annotation has no editable faces (carved...)
//   NOT_ON_ONE_FACE   the path does not lie on one face
//   NOT_EDGE_TO_EDGE  it lies on a face but does not run edge to edge
export default async function cutFaceAlongPathService({
  editor,
  vertices,
  closed = false,
  projectId,
  dispatch,
  createAnnotationFn,
  updateAnnotationFn,
}) {
  if (!editor || !vertices || vertices.length < 2) {
    return { kind: "NONE", reason: "NO_ANNOTATION" };
  }

  let reason = "NO_ANNOTATION";
  const keepReason = (next) => {
    if (REASON_RANK.indexOf(next) > REASON_RANK.indexOf(reason)) {
      reason = next;
    }
  };
  for (const annotationId of getCandidateAnnotationIds(editor, vertices)) {
    // First pass on the DISPLAYED object (unshrink: false): a candidate the
    // path does not cut — or one split in plan — keeps its anti-aliasing
    // shrink. Only the mesh split below reads (and exempts) the un-shrunk
    // object it writes.
    let ctx = await getEditableMesh3d({
      editor,
      annotationId,
      unshrink: false,
    });
    if (!ctx) {
      console.warn(
        `[threedFaceCut] ${annotationId}: no editable faces (not convertible to a mesh: carved, generated shape...)`
      );
      keepReason("NOT_EDITABLE");
      continue;
    }
    const camera = editor.sceneManager?.camera;
    let { local, split } = splitPathOnMesh3d(ctx, vertices, closed, camera);
    if (!split) {
      const why = explainNoSplit(ctx.mesh, local, closed);
      console.warn(`[threedFaceCut] ${annotationId}: no cut`, why);
      keepReason(why.reason);
      continue;
    }

    if (ctx.isConversion && (await canSplitIn2d(ctx.annotation))) {
      const normal = getFaceNormal(
        ctx.mesh.vertices,
        ctx.mesh.faces[split.faceIndex]
      );
      const plan = local.map((p) => ({ x: p.x, y: p.y }));
      const args = {
        ctx,
        plan,
        closed,
        projectId,
        createAnnotationFn,
        updateAnnotationFn,
      };
      if (
        ctx.annotation.type === "POLYGON" &&
        Math.abs(normal.z) >= PLAN_FACE_MIN_NORMAL_Z &&
        (await splitPolygonIn2d(args))
      ) {
        return { kind: "POLYGON_2D", annotationId };
      }
      if (
        ctx.annotation.type === "POLYLINE" &&
        Math.abs(normal.z) <= VERTICAL_FACE_MAX_NORMAL_Z &&
        (await splitWallIn2d(args))
      ) {
        return { kind: "WALL_2D", annotationId };
      }
    }

    // The mesh is written: split the un-shrunk object.
    if (ctx.isShrunk) {
      const unshrunk = await getEditableMesh3d({ editor, annotationId });
      const resplit = unshrunk
        ? splitPathOnMesh3d(unshrunk, vertices, closed, camera)
        : null;
      if (!resplit?.split) {
        console.warn(
          `[threedFaceCut] ${annotationId}: no cut on the un-shrunk object`
        );
        keepReason("NOT_ON_ONE_FACE");
        continue;
      }
      ctx = unshrunk;
      ({ local, split } = resplit);
    }

    const annotation = await writeMesh3dService({
      annotation: ctx.annotation,
      mesh: split.mesh,
      baseOffsetZ: ctx.baseOffsetZ,
      metrics: ctx.metrics,
      dispatch,
    });
    return annotation
      ? { kind: "MESH", annotationId: annotation.id }
      : { kind: "FAILED" };
  }
  return { kind: "NONE", reason };
}

// The path (world points) split on an editable mesh: { local, split }
// (split null when it cuts no face). A conversion may read an object up to
// 10 mm away from the one the path was drawn on (anti-aliasing shrink, either
// way): the face is then re-detected near the path and the path moved onto
// it.
function splitPathOnMesh3d(ctx, vertices, closed, camera) {
  let local = vertices.map((v) => worldToMesh3dLocal(v, ctx));
  let split = splitMesh3dFaceDetailed(ctx.mesh, local, { closed });
  if (!split && ctx.isConversion) {
    const snapped = snapPathOntoMesh3dFace(ctx.mesh, local, {
      closed,
      rayDir: getViewRayLocal(ctx, vertices, camera),
    });
    if (snapped) {
      const resplit = splitMesh3dFaceDetailed(ctx.mesh, snapped.points, {
        closed,
        faceIndices: [snapped.faceIndex],
      });
      if (resplit) {
        local = snapped.points;
        split = resplit;
      }
    }
  }
  return { local, split };
}

// View ray (camera → path centroid) in the editable mesh's local frame.
function getViewRayLocal(ctx, vertices, camera) {
  if (!camera || !vertices?.length) return null;
  const centroid = new Vector3();
  vertices.forEach((v) => centroid.add(new Vector3(v.x, v.y, v.z)));
  centroid.divideScalar(vertices.length);
  const origin = camera.isOrthographicCamera
    ? centroid.clone().sub(camera.getWorldDirection(new Vector3()))
    : camera.getWorldPosition(new Vector3());
  const a = worldToMesh3dLocal(origin, ctx);
  const b = worldToMesh3dLocal(centroid, ctx);
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

const REASON_RANK = [
  "NO_ANNOTATION",
  "NOT_EDITABLE",
  "NOT_ON_ONE_FACE",
  "NOT_EDGE_TO_EDGE",
];

// Why a path splits no face of a mesh (diagnostics): the face carrying it
// with where its points fall (a dangling end reads INSIDE), else the face it
// comes closest to lying on (max distance of its points to the plane, points
// outside the face).
function explainNoSplit(mesh, points, closed) {
  const faceIndex = locatePathOnMesh3d(mesh, points, { closed });
  if (faceIndex >= 0) {
    const face = mesh.faces[faceIndex];
    const face2d = getFace2d(mesh.vertices, face);
    const kinds = points.map(
      (p) =>
        classifyPointOnFace(face2d, face, projectPointTo2d(p, face2d.basis))
          .kind
    );
    return { reason: "NOT_EDGE_TO_EDGE", faceIndex, kinds };
  }
  let best = null;
  mesh.faces.forEach((face, index) => {
    const normal = getFaceNormal(mesh.vertices, face);
    const planeDistanceM = Math.max(
      ...points.map((p) =>
        Math.abs(getDistanceToFacePlane(mesh.vertices, face, p, normal))
      )
    );
    if (best && planeDistanceM >= best.planeDistanceM) return;
    const face2d = getFace2d(mesh.vertices, face);
    const kinds = points.map(
      (p) =>
        classifyPointOnFace(face2d, face, projectPointTo2d(p, face2d.basis))
          .kind
    );
    best = { faceIndex: index, planeDistanceM, kinds };
  });
  return { reason: "NOT_ON_ONE_FACE", closestFace: best };
}

// Annotations that may carry the path: the ones the snaps pointed at (the
// most pointed first), then every visible MESH annotation whose box holds
// the whole path (snaps on in-progress points carry no annotation id).
function getCandidateAnnotationIds(editor, vertices) {
  const counts = new Map();
  for (const v of vertices) {
    if (v.nodeId) counts.set(v.nodeId, (counts.get(v.nodeId) ?? 0) + 1);
  }
  const ids = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));

  const objectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  const box = new Box3();
  const point = new Vector3();
  for (const [id, object] of Object.entries(objectsMap)) {
    if (ids.includes(id) || !object?.userData?.isAnnotationMesh3d) continue;
    if (!isObjectChainVisible(object)) continue;
    box.setFromObject(object).expandByScalar(BOX_TOL_M);
    if (box.isEmpty()) continue;
    if (vertices.every((v) => box.containsPoint(point.set(v.x, v.y, v.z)))) {
      ids.push(id);
    }
  }
  return ids;
}

// A plan split leaves the openings glued on the host and the subtractions
// it takes part in pointing at one piece only: those go through the mesh.
async function canSplitIn2d(annotation) {
  if (Number(annotation.rotation)) return false;
  const [openings, subtractionsAsSource, subtractionsAsTarget] =
    await Promise.all([
      db.relAnnotationOpenings
        .where("hostAnnotationId")
        .equals(annotation.id)
        .toArray(),
      db.relAnnotationSubtractions
        .where("sourceAnnotationId")
        .equals(annotation.id)
        .toArray(),
      db.relAnnotationSubtractions
        .where("targetAnnotationId")
        .equals(annotation.id)
        .toArray(),
    ]);
  return ![...openings, ...subtractionsAsSource, ...subtractionsAsTarget].some(
    (rel) => !rel.deletedAt
  );
}

// Point refs of the annotation with their plan position (base-map-local m).
async function resolveRefs(refs, metrics) {
  if (!refs?.length) return null;
  const rows = await db.points.bulkGet(refs.map((ref) => ref.id));
  const resolved = refs.map((ref, i) =>
    rows[i] && !rows[i].deletedAt
      ? { ref, ...normalizedToLocal([rows[i].x, rows[i].y], metrics) }
      : null
  );
  return resolved.every(Boolean) ? resolved : null;
}

// Painted parts (« Pinceau ») of the cut host are distributed over the two
// pieces from their plan projection: kept, re-hosted on the new piece (its
// end cap...), or spread with provisional copies — skipped when the piece
// does not exist (the create hook does not throw on a refused write).
async function copyPaintsToPiece(sourceHostId, pieceId, metrics) {
  await copyMeshPaintsForSplit({
    sourceHostId,
    newHostIds: [pieceId],
    metrics,
  });
}

// Fields of the original annotation the second piece copies.
function getPieceProps(annotation) {
  const props = { ...annotation };
  for (const key of [
    "id",
    "entityId",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdByUserIdMaster",
    "points",
    "cuts",
  ]) {
    delete props[key];
  }
  return props;
}

function newPointRow(x, y, { ctx, projectId }) {
  const [nx, ny] = localToNormalized({ x, y }, ctx.metrics);
  return {
    id: nanoid(),
    x: nx,
    y: ny,
    projectId,
    baseMapId: ctx.annotation.baseMapId,
    ...(ctx.annotation.listingId
      ? { listingId: ctx.annotation.listingId }
      : {}),
  };
}

const lerp = (a, b, t) =>
  (Number(a) || 0) + ((Number(b) || 0) - (Number(a) || 0)) * t;

function ringArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// POLYGON cut on its plan face: the outline split along the plan projection
// of the path (or a hole + an inner polygon for a loop). The bigger piece
// keeps the annotation; new corners take the per-vertex offsets of the
// (planar) outline at their position.
async function splitPolygonIn2d({
  ctx,
  plan,
  closed,
  projectId,
  createAnnotationFn,
  updateAnnotationFn,
}) {
  const { annotation, metrics } = ctx;
  const outline = await resolveRefs(annotation.points, metrics);
  if (!outline || outline.length < 3) return false;
  const cuts = (annotation.cuts ?? []).filter((cut) => cut?.points?.length);
  const holes = [];
  for (const cut of cuts) {
    const hole = await resolveRefs(cut.points, metrics);
    if (!hole) return false;
    holes.push(hole);
  }

  const offsetAt = {
    offsetBottom: fitPlanarValue(
      outline.map((p) => ({
        x: p.x,
        y: p.y,
        value: Number(p.ref.offsetBottom) || 0,
      }))
    ),
    offsetTop: fitPlanarValue(
      outline.map((p) => ({
        x: p.x,
        y: p.y,
        value: Number(p.ref.offsetTop) || 0,
      }))
    ),
  };
  const pointRows = [];
  const newRef = (x, y, offsets) => {
    const row = newPointRow(x, y, { ctx, projectId });
    pointRows.push(row);
    return {
      id: row.id,
      type: "square",
      offsetBottom: offsets?.offsetBottom ?? offsetAt.offsetBottom(x, y),
      offsetTop: offsets?.offsetTop ?? offsetAt.offsetTop(x, y),
    };
  };

  let keep;
  let other;
  if (closed) {
    const inner = locateInnerLoopInRing(outline, plan, {
      tolerance: PLAN_TOL_M,
      holes,
    });
    if (!inner) return false;
    const loopRefs = plan.map((p) => newRef(p.x, p.y));
    keep = {
      points: annotation.points,
      cuts: [
        ...cuts.filter((_, i) => !inner.enclosedHoles.includes(i)),
        { points: loopRefs.map((ref) => ({ id: ref.id })) },
      ],
    };
    other = {
      points: loopRefs,
      cuts: cuts.filter((_, i) => inner.enclosedHoles.includes(i)),
    };
  } else {
    const split = splitRing2dByPath(outline, plan, {
      tolerance: PLAN_TOL_M,
      holes,
    });
    if (!split) return false;
    const refByEntry = new Map();
    const toRef = (entry) => {
      if (entry.kind === "VERTEX") return outline[entry.index].ref;
      if (!refByEntry.has(entry)) {
        const offsets =
          entry.kind === "EDGE"
            ? {
                offsetBottom: lerp(
                  outline[entry.index].ref.offsetBottom,
                  outline[(entry.index + 1) % outline.length].ref.offsetBottom,
                  entry.t
                ),
                offsetTop: lerp(
                  outline[entry.index].ref.offsetTop,
                  outline[(entry.index + 1) % outline.length].ref.offsetTop,
                  entry.t
                ),
              }
            : null;
        refByEntry.set(entry, newRef(entry.x, entry.y, offsets));
      }
      return refByEntry.get(entry);
    };
    const toPoint = (entry) =>
      entry.kind === "VERTEX" ? outline[entry.index] : entry;
    const pieceA = {
      points: split.ringA.map(toRef),
      cuts: split.holesA.map((i) => cuts[i]),
      area: ringArea(split.ringA.map(toPoint)),
    };
    const pieceB = {
      points: split.ringB.map(toRef),
      cuts: split.holesB.map((i) => cuts[i]),
      area: ringArea(split.ringB.map(toPoint)),
    };
    [keep, other] =
      pieceA.area >= pieceB.area ? [pieceA, pieceB] : [pieceB, pieceA];
  }

  // One Ctrl+Z undoes the whole cut — painted parts included: the source's
  // paints are kept, re-hosted on the new piece or spread over both
  // (provisional copies the re-sync trims), see copyMeshPaintsForSplit.
  const pieceId = nanoid();
  await withUndoGroup(async () => {
    await db.points.bulkAdd(pointRows);
    await updateAnnotationFn({
      ...annotation,
      points: keep.points,
      cuts: keep.cuts,
    });
    await createAnnotationFn({
      ...getPieceProps(annotation),
      id: pieceId,
      points: other.points,
      cuts: other.cuts,
    });
    await copyPaintsToPiece(annotation.id, pieceId, metrics);
  });
  return true;
}

// Wall (POLYLINE) cut vertically on its side: the polyline split at the plan
// position of the cut — on a vertex, or on a new vertex inserted there with
// the per-vertex offsets of its segment. A closed wall is opened there.
async function splitWallIn2d({
  ctx,
  plan,
  closed,
  projectId,
  createAnnotationFn,
  updateAnnotationFn,
}) {
  if (closed) return false;
  const center = {
    x: plan.reduce((sum, p) => sum + p.x, 0) / plan.length,
    y: plan.reduce((sum, p) => sum + p.y, 0) / plan.length,
  };
  if (plan.some((p) => Math.hypot(p.x - center.x, p.y - center.y) > PLAN_TOL_M))
    return false;

  const { annotation, metrics } = ctx;
  const line = await resolveRefs(annotation.points, metrics);
  if (!line || line.length < 2) return false;
  const closeLine = Boolean(annotation.closeLine);
  const location = locatePlanPointOnPolyline(line, center, {
    closeLine,
    tolerance: PLAN_TOL_M,
  });
  if (!location) return false;

  let refs = annotation.points;
  let vertexIndex = location.vertexIndex;
  let pointRow = null;
  if (vertexIndex === undefined) {
    const { segmentIndex, t, x, y } = location;
    const a = line[segmentIndex].ref;
    const b = line[(segmentIndex + 1) % line.length].ref;
    pointRow = newPointRow(x, y, { ctx, projectId });
    const ref = {
      ...a,
      id: pointRow.id,
      offsetBottom: lerp(a.offsetBottom, b.offsetBottom, t),
      offsetTop: lerp(a.offsetTop, b.offsetTop, t),
    };
    vertexIndex = segmentIndex + 1;
    refs = [...refs.slice(0, vertexIndex), ref, ...refs.slice(vertexIndex)];
  }

  // An end of an open wall: its end face, nothing to split in plan.
  const pieces = splitPolylineAtVertex(refs, vertexIndex, closeLine);
  if (!pieces) return false;

  // One Ctrl+Z undoes the whole cut — painted parts included (distributed
  // over the pieces, see splitPolygonIn2d).
  await withUndoGroup(async () => {
    if (pointRow) await db.points.add(pointRow);
    await updateAnnotationFn({
      ...annotation,
      points: pieces.piece1,
      closeLine: false,
    });
    if (pieces.piece2) {
      const pieceId = nanoid();
      await createAnnotationFn({
        ...getPieceProps(annotation),
        id: pieceId,
        points: pieces.piece2,
        closeLine: false,
      });
      await copyPaintsToPiece(annotation.id, pieceId, metrics);
    }
  });
  return true;
}
