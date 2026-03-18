import db from "App/db/db";
import projectPointOnSegment from "../utils/projectPointOnSegment";

/**
 * Resolves point coordinates from db.points table.
 * Returns a Map of pointId -> { x, y }.
 */
async function resolvePointCoords(pointIds) {
  const points = await db.points.bulkGet(pointIds);
  const coordsMap = new Map();
  for (const pt of points) {
    if (pt) coordsMap.set(pt.id, { x: pt.x, y: pt.y });
  }
  return coordsMap;
}

/**
 * Collects all paths from an annotation, with resolved coordinates.
 * Returns array of { key, cutIndex?, refs (original { id } entries), coords (resolved {x,y} arrays) }
 */
function collectTargetPaths(annotation, coordsMap) {
  const paths = [];
  if (Array.isArray(annotation.points) && annotation.points.length >= 2) {
    const coords = annotation.points
      .map((p) => coordsMap.get(p.id))
      .filter(Boolean);
    if (coords.length >= 2) {
      paths.push({ key: "points", refs: annotation.points, coords });
    }
  }
  if (Array.isArray(annotation.cuts)) {
    annotation.cuts.forEach((cut, i) => {
      if (Array.isArray(cut.points) && cut.points.length >= 2) {
        const coords = cut.points
          .map((p) => coordsMap.get(p.id))
          .filter(Boolean);
        if (coords.length >= 2) {
          paths.push({ key: "cuts", cutIndex: i, refs: cut.points, coords });
        }
      }
    });
  }
  return paths;
}

/**
 * Finds the closest segment across all paths for a given point (with resolved coords).
 */
function findClosestSegment(point, paths) {
  let best = null;
  for (let pi = 0; pi < paths.length; pi++) {
    const coords = paths[pi].coords;
    for (let si = 0; si < coords.length - 1; si++) {
      const result = projectPointOnSegment(point, coords[si], coords[si + 1]);
      if (!best || result.distance < best.distance) {
        best = {
          distance: result.distance,
          projectedPoint: result.projectedPoint,
          t: result.t,
          pathIndex: pi,
          segmentIndex: si,
        };
      }
    }
  }
  return best;
}

/**
 * Anchors annotation A's extremities onto the closest segments of annotation B.
 * Both annotations and the db.points table are updated.
 *
 * @param {string} sourceId - Annotation A id (the one being anchored)
 * @param {string} targetId - Annotation B id (the one to anchor onto)
 */
export default async function anchorAnnotationToTarget(sourceId, targetId) {
  const [source, target] = await Promise.all([
    db.annotations.get(sourceId),
    db.annotations.get(targetId),
  ]);

  if (!source?.points?.length || source.points.length < 2) return;

  // Collect all point IDs from both annotations
  const allPointIds = new Set();
  for (const p of source.points) allPointIds.add(p.id);
  for (const p of target.points || []) allPointIds.add(p.id);
  if (target.cuts) {
    for (const cut of target.cuts) {
      for (const p of cut.points || []) allPointIds.add(p.id);
    }
  }

  // Resolve all coordinates from db.points
  const coordsMap = await resolvePointCoords([...allPointIds]);

  const targetPaths = collectTargetPaths(target, coordsMap);
  if (targetPaths.length === 0) return;

  // Collect all target point IDs for shared-point detection
  const targetPointIds = new Set();
  for (const p of target.points || []) targetPointIds.add(p.id);
  if (target.cuts) {
    for (const cut of target.cuts) {
      for (const p of cut.points || []) targetPointIds.add(p.id);
    }
  }

  // Resolve source extremities
  const firstPointId = source.points[0].id;
  const lastPointId = source.points[source.points.length - 1].id;
  const firstCoord = coordsMap.get(firstPointId);
  const lastCoord = coordsMap.get(lastPointId);

  if (!firstCoord && !lastCoord) return;

  // Check if an extremity is already shared with target
  const firstIsShared = targetPointIds.has(firstPointId);
  const lastIsShared = targetPointIds.has(lastPointId);

  // Find closest segment for each candidate extremity
  const firstResult =
    firstCoord && !firstIsShared
      ? findClosestSegment(firstCoord, targetPaths)
      : null;
  const lastResult =
    lastCoord && !lastIsShared
      ? findClosestSegment(lastCoord, targetPaths)
      : null;

  if (!firstResult && !lastResult) return;

  // Pick only ONE extremity: the closest. If it's already shared, take the other.
  let chosen;
  if (firstResult && lastResult) {
    chosen =
      firstResult.distance <= lastResult.distance
        ? { extremityIndex: 0, pointId: firstPointId, result: firstResult }
        : {
            extremityIndex: source.points.length - 1,
            pointId: lastPointId,
            result: lastResult,
          };
  } else if (firstResult) {
    chosen = { extremityIndex: 0, pointId: firstPointId, result: firstResult };
  } else {
    chosen = {
      extremityIndex: source.points.length - 1,
      pointId: lastPointId,
      result: lastResult,
    };
  }

  const anchors = [chosen];

  // Prepare updates
  const pointUpdates = []; // { id, x, y } to update in db.points

  // Track insertions per target path
  const insertionsByPath = new Map();

  for (const { extremityIndex, pointId, result } of anchors) {
    const { projectedPoint, pathIndex, segmentIndex } = result;

    // Update source extremity coordinates in db.points
    pointUpdates.push({
      id: pointId,
      x: projectedPoint.x,
      y: projectedPoint.y,
    });

    // Reuse the SAME pointId in target's path (shared topology point)
    // Store segment endpoint IDs for robust insertion (avoids index shift issues)
    const path = targetPaths[pathIndex];
    const segStartId = path.refs[segmentIndex]?.id;
    const segEndId = path.refs[segmentIndex + 1]?.id;

    if (!insertionsByPath.has(pathIndex)) {
      insertionsByPath.set(pathIndex, []);
    }
    insertionsByPath.get(pathIndex).push({
      segStartId,
      segEndId,
      pointRef: { id: pointId },
    });
  }

  // Build updated target point ref arrays
  const newTargetPointRefs = target.points
    ? [...target.points.map((p) => ({ ...p }))]
    : [];
  const newTargetCuts = target.cuts
    ? target.cuts.map((c) => ({
        ...c,
        points: [...(c.points || []).map((p) => ({ ...p }))],
      }))
    : [];

  for (const [pathIndex, insertions] of insertionsByPath) {
    const pathInfo = targetPaths[pathIndex];

    const targetArr =
      pathInfo.key === "points"
        ? newTargetPointRefs
        : newTargetCuts[pathInfo.cutIndex].points;

    // Find insertion positions by matching consecutive point IDs
    const resolved = insertions
      .map((ins) => {
        for (let i = 0; i < targetArr.length - 1; i++) {
          if (
            targetArr[i].id === ins.segStartId &&
            targetArr[i + 1].id === ins.segEndId
          ) {
            return { ...ins, insertAt: i + 1 };
          }
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.insertAt - a.insertAt);

    for (const ins of resolved) {
      targetArr.splice(ins.insertAt, 0, ins.pointRef);
    }
  }

  // Build annotation updates
  const targetUpdate = {};
  for (const [pathIndex] of insertionsByPath) {
    const pathInfo = targetPaths[pathIndex];
    if (pathInfo.key === "points") targetUpdate.points = newTargetPointRefs;
    if (pathInfo.key === "cuts") targetUpdate.cuts = newTargetCuts;
  }

  // Persist all changes
  await Promise.all([
    // Update source extremity coords in db.points
    ...pointUpdates.map((p) => db.points.update(p.id, { x: p.x, y: p.y })),
    // Update target annotation refs (inserts shared point references)
    Object.keys(targetUpdate).length > 0
      ? db.annotations.update(targetId, targetUpdate)
      : Promise.resolve(),
  ]);
}
