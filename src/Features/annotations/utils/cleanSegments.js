// cleanSegments
//
// Cleans a multi-selection of 2-point POLYLINE annotations (segments):
//   1. Merges collinear segments whose perpendicular distance is < 1 px AND
//      whose projected intervals overlap or touch.
//   2. Snaps endpoints that form an L or T junction with another, near-
//      perpendicular segment. Trigger and snap-target rules:
//        - Trigger: the endpoint's perpendicular projection lies within
//          the other segment's extent AND
//          perpDist < halfStroke + BORDER_PROXIMITY_PX (covers e just
//          outside b within 3 px of nearest border, AND e anywhere INSIDE
//          b's stroke).
//        - Snap target side:
//            * borderDist < BORDER_PROXIMITY_PX (e is close to one of b's
//              borders, either side) → snap to e's CURRENT side. Pulls e
//              to the border it's already near.
//            * borderDist ≥ BORDER_PROXIMITY_PX (e is DEEP inside b, far
//              from any border) → snap to the ANCHOR's side. The endpoint
//              is brought back to the border on the side a's body comes
//              from — "touch the segment but don't traverse it".
//        - The endpoint is moved to the line at perpendicular offset
//          (halfStroke − SNAP_DEPTH_PX) on the chosen side, constrained to
//          the segment's ORIGINAL direction line (anchored at the other
//          endpoint), so the segment keeps its direction and only its
//          length changes. Free endpoints (neither inside b nor close to
//          its border) are NEVER moved.
//        - Special "V junction" case: when BOTH segments have an endpoint
//          near a border of the other (within BORDER_PROXIMITY_PX, inside
//          OR just outside — the latter makes the cleanup idempotent), the
//          regular rule leaves both endpoints overlapping ambiguously. We
//          pick one (deterministically: smaller annotation id wins):
//            * WINNER: snap target = (halfStroke + SNAP_DEPTH_PX) on e's
//              CURRENT side — its tip sticks 1 px PAST the other's border.
//            * LOSER : snap target = (halfStroke − SNAP_DEPTH_PX) on the
//              ANCHOR's side — tucked 1 px INSIDE the other from the side
//              the loser's body comes from (terminates cleanly at the
//              corner instead of passing through).
//   3. Unifies the ids of endpoints that end up at the same location.
//
// Returns: { updates: [{ id, points }], deleteIds: string[] }
//
// Pure function: no React, no Redux, no Dexie.

const ANGLE_TOL_DEG = 3;
const ANGLE_TOL_RAD = (ANGLE_TOL_DEG * Math.PI) / 180;
const COS_PARALLEL = Math.cos(ANGLE_TOL_RAD);
const SIN_PERPENDICULAR = Math.sin(ANGLE_TOL_RAD);

// Step 2 — collinear merge.
const COLINEAR_PERP_TOL_PX = 1; // segments must be within 1 px perpendicular
const COLINEAR_OVERLAP_TOL_PX = 1; // intervals merged if gap <= 1 px

// Step 3 — L/T junction snap.
const BORDER_PROXIMITY_PX = 3; // trigger: endpoint within 3 px of other's border
const SNAP_DEPTH_PX = 1; // penetration depth past the border (toward median)

// Step 4 — id unification.
const COINCIDENT_TOL_PX = 1;

function strokeWidthToPx(strokeWidth, strokeWidthUnit, meterByPx) {
  const value = parseFloat(strokeWidth);
  if (!Number.isFinite(value)) return 0;
  if (!strokeWidthUnit || strokeWidthUnit === "PX") return value;
  if (!meterByPx) return 0;
  if (strokeWidthUnit === "M") return value / meterByPx;
  if (strokeWidthUnit === "CM") return value / 100 / meterByPx;
  return 0;
}

function makeDir(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { dir: { x: 1, y: 0 }, length: 0 };
  return { dir: { x: dx / length, y: dy / length }, length };
}

function dotAbs(a, b) {
  return Math.abs(a.x * b.x + a.y * b.y);
}

function areParallel(a, b) {
  if (a.length === 0 || b.length === 0) return false;
  return dotAbs(a.dir, b.dir) > COS_PARALLEL;
}

function arePerpendicular(a, b) {
  if (a.length === 0 || b.length === 0) return false;
  return dotAbs(a.dir, b.dir) < SIN_PERPENDICULAR;
}

function perpDistanceToLine(point, linePoint, lineDir) {
  const nx = -lineDir.y;
  const ny = lineDir.x;
  return Math.abs((point.x - linePoint.x) * nx + (point.y - linePoint.y) * ny);
}

function signedSideOfLine(point, linePoint, lineDir) {
  const nx = -lineDir.y;
  const ny = lineDir.x;
  const d = (point.x - linePoint.x) * nx + (point.y - linePoint.y) * ny;
  return d >= 0 ? 1 : -1;
}

// Project point onto the infinite line through segStart with unit segDir.
// Returns { x, y, t (in px along segDir from segStart), perpDist }.
function projectOnInfiniteLine(point, segStart, segDir) {
  const t =
    (point.x - segStart.x) * segDir.x + (point.y - segStart.y) * segDir.y;
  const projX = segStart.x + t * segDir.x;
  const projY = segStart.y + t * segDir.y;
  const perpDist = Math.hypot(point.x - projX, point.y - projY);
  return { x: projX, y: projY, t, perpDist };
}

export default function cleanSegments({ segments, meterByPx }) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { updates: [], deleteIds: [] };
  }

  // 1. Normalize working state (deep-copy points).
  const state = segments.map((s) => {
    const p1 = { ...s.points[0] };
    const p2 = { ...s.points[1] };
    const { dir, length } = makeDir(p1, p2);
    return {
      id: s.id,
      points: [p1, p2],
      dir,
      length,
      strokeWidthPx: strokeWidthToPx(
        s.strokeWidth,
        s.strokeWidthUnit,
        meterByPx
      ),
      alive: true,
      originalPoints: s.points,
      // Optional tag: when several segments come from the same original
      // multi-point polyline, we don't want them to snap onto each other
      // in step 3 (would break L-corners inside the original polyline).
      originAnnotationId: s.originAnnotationId ?? null,
    };
  });

  // 2. Collinear clustering + overlap merge (strict 1 px perpendicular tol).
  const clusterAssignment = new Array(state.length).fill(-1);
  const clusters = [];
  for (let i = 0; i < state.length; i++) {
    if (clusterAssignment[i] >= 0) continue;
    const clusterId = clusters.length;
    const cluster = [i];
    clusterAssignment[i] = clusterId;
    const a = state[i];
    for (let j = i + 1; j < state.length; j++) {
      if (clusterAssignment[j] >= 0) continue;
      const b = state[j];
      if (!areParallel(a, b)) continue;
      if (
        perpDistanceToLine(b.points[0], a.points[0], a.dir) >
        COLINEAR_PERP_TOL_PX
      )
        continue;
      cluster.push(j);
      clusterAssignment[j] = clusterId;
    }
    clusters.push(cluster);
  }

  for (const cluster of clusters) {
    if (cluster.length < 2) continue;
    const ref = state[cluster[0]];
    const refOrigin = ref.points[0];
    const refDir = ref.dir;

    const intervals = cluster.map((idx) => {
      const seg = state[idx];
      const t1 =
        (seg.points[0].x - refOrigin.x) * refDir.x +
        (seg.points[0].y - refOrigin.y) * refDir.y;
      const t2 =
        (seg.points[1].x - refOrigin.x) * refDir.x +
        (seg.points[1].y - refOrigin.y) * refDir.y;
      return { idx, tMin: Math.min(t1, t2), tMax: Math.max(t1, t2) };
    });

    intervals.sort((a, b) => a.tMin - b.tMin);

    const groups = [];
    let current = null;
    for (const iv of intervals) {
      if (!current) {
        current = { tMin: iv.tMin, tMax: iv.tMax, members: [iv.idx] };
      } else if (iv.tMin <= current.tMax + COLINEAR_OVERLAP_TOL_PX) {
        current.tMax = Math.max(current.tMax, iv.tMax);
        current.members.push(iv.idx);
      } else {
        groups.push(current);
        current = { tMin: iv.tMin, tMax: iv.tMax, members: [iv.idx] };
      }
    }
    if (current) groups.push(current);

    for (const group of groups) {
      if (group.members.length < 2) continue;
      const keepIdx = group.members[0];
      const kept = state[keepIdx];
      const newP1 = {
        ...kept.points[0],
        x: refOrigin.x + group.tMin * refDir.x,
        y: refOrigin.y + group.tMin * refDir.y,
      };
      const newP2 = {
        ...kept.points[1],
        x: refOrigin.x + group.tMax * refDir.x,
        y: refOrigin.y + group.tMax * refDir.y,
      };
      kept.points = [newP1, newP2];
      const refreshed = makeDir(newP1, newP2);
      kept.dir = refreshed.dir;
      kept.length = refreshed.length;

      for (let k = 1; k < group.members.length; k++) {
        state[group.members[k]].alive = false;
      }
    }
  }

  // 3. L/T-junction snap.
  //
  // Use a snapshot of post-step-2 geometry so the result is order-independent.
  // For each ordered pair (a, b) of near-perpendicular segments and each
  // endpoint e of a:
  //   - skip unless e's perpendicular projection onto b's centerline lies
  //     within b's extent (no junction otherwise);
  //   - skip unless e is within (halfStroke + BORDER_PROXIMITY_PX) of b's
  //     centerline (covers two real cases: e just outside b within 3 px of
  //     the nearest border, OR e anywhere INSIDE b's stroke);
  //   - choose the snap target side:
  //       * if e is close to a border (borderDist < BORDER_PROXIMITY_PX)
  //         → e's CURRENT side (snap to nearest border);
  //       * else (e is deep inside b) → the ANCHOR's side, so e is brought
  //         back to the border on the side a's body comes from.
  //   - compute snap target = intersection of a's ORIGINAL direction line
  //     (anchored at a's other endpoint) with the line parallel to b's
  //     centerline at perpendicular offset (halfStroke - SNAP_DEPTH_PX) on
  //     the chosen side.
  //   - move e there. The segment's direction is unchanged (only length).
  const aliveIndices = [];
  for (let i = 0; i < state.length; i++) {
    if (state[i].alive) aliveIndices.push(i);
  }

  const snapshot = new Map();
  for (const idx of aliveIndices) {
    const s = state[idx];
    snapshot.set(idx, {
      p0: { x: s.points[0].x, y: s.points[0].y },
      p1: { x: s.points[1].x, y: s.points[1].y },
      dir: { x: s.dir.x, y: s.dir.y },
      length: s.length,
      strokeWidthPx: s.strokeWidthPx,
    });
  }

  // Pre-pass — detect "V" junctions, where BOTH segments have an endpoint
  // INSIDE the other within BORDER_PROXIMITY_PX of one of its borders. With
  // the regular snap rule both endpoints stay 1 px inside their respective
  // near borders, producing an ambiguous overlap at the corner. To resolve
  // this we mark ONE endpoint per V junction as "stickOut": its snap target
  // becomes 1 px OUTSIDE its near border (instead of 1 px inside), so the
  // L-corner has one segment extending past and the other tucked inside —
  // a clean L. The "winner" (= the segment whose endpoint sticks out) is
  // chosen deterministically: the segment whose id sorts smaller.
  const stickOutEndpoints = new Set(); // V junction winners — sign=sideE, target=halfStroke+1
  const tuckInsideEndpoints = new Set(); // V junction losers — sign=sideAnchor, target=halfStroke-1

  // V junction detection: an endpoint qualifies if it's within
  // BORDER_PROXIMITY_PX of one of `dst`'s borders, EITHER from the inside
  // (e is in dst's stroke, close to a border) OR from just outside (e is
  // past a border by < BORDER_PROXIMITY_PX). Including the "just outside"
  // case is what makes the cleanup idempotent: after the winner has been
  // pushed 1 px past the border in a previous run, re-running the cleanup
  // still detects the V junction and keeps the winner at +1 px outside
  // (instead of the regular snap pulling it back inside, which would make
  // the algo oscillate between two states).
  function findNearBorderEndpoint(srcSnap, dstSnap) {
    const halfDst = dstSnap.strokeWidthPx / 2;
    for (let i = 0; i < 2; i++) {
      const e = i === 0 ? srcSnap.p0 : srcSnap.p1;
      const proj = projectOnInfiniteLine(e, dstSnap.p0, dstSnap.dir);
      if (proj.t < 0 || proj.t > dstSnap.length) continue;
      const borderDist = Math.abs(proj.perpDist - halfDst);
      if (borderDist >= BORDER_PROXIMITY_PX) continue;
      return i;
    }
    return -1;
  }

  for (let ai = 0; ai < aliveIndices.length; ai++) {
    for (let bi = ai + 1; bi < aliveIndices.length; bi++) {
      const aIdx = aliveIndices[ai];
      const bIdx = aliveIndices[bi];
      const a = state[aIdx];
      const b = state[bIdx];
      const aSnap = snapshot.get(aIdx);
      const bSnap = snapshot.get(bIdx);
      if (!arePerpendicular(aSnap, bSnap)) continue;
      if (aSnap.length === 0 || bSnap.length === 0) continue;
      if (
        a.originAnnotationId &&
        b.originAnnotationId &&
        a.originAnnotationId === b.originAnnotationId
      )
        continue;

      const aEndpointIdx = findNearBorderEndpoint(aSnap, bSnap);
      if (aEndpointIdx < 0) continue;
      const bEndpointIdx = findNearBorderEndpoint(bSnap, aSnap);
      if (bEndpointIdx < 0) continue;

      // Both segments have an endpoint near the corner → V junction.
      // Pick the winner deterministically (smaller id wins). The winner's
      // tip sticks 1 px PAST its near border (on its current side). The
      // loser's tip is tucked 1 px INSIDE the other from the side its body
      // comes from (anchor's side) — this terminates the loser cleanly at
      // the corner instead of letting it sit anywhere along the other.
      let winnerKey, loserKey;
      if (a.id < b.id) {
        winnerKey = `${aIdx}:${aEndpointIdx}`;
        loserKey = `${bIdx}:${bEndpointIdx}`;
      } else {
        winnerKey = `${bIdx}:${bEndpointIdx}`;
        loserKey = `${aIdx}:${aEndpointIdx}`;
      }
      stickOutEndpoints.add(winnerKey);
      tuckInsideEndpoints.add(loserKey);
    }
  }

  for (const aIdx of aliveIndices) {
    const a = state[aIdx];
    const aSnap = snapshot.get(aIdx);
    for (const bIdx of aliveIndices) {
      if (aIdx === bIdx) continue;
      const b = state[bIdx];
      const bSnap = snapshot.get(bIdx);
      if (!arePerpendicular(aSnap, bSnap)) continue;
      if (bSnap.length === 0) continue;
      // Don't snap two pieces of the same parent polyline onto each other.
      if (
        a.originAnnotationId &&
        b.originAnnotationId &&
        a.originAnnotationId === b.originAnnotationId
      )
        continue;

      const halfStroke = bSnap.strokeWidthPx / 2;
      const perpDirB = { x: -bSnap.dir.y, y: bSnap.dir.x };

      for (let i = 0; i < 2; i++) {
        const e = i === 0 ? aSnap.p0 : aSnap.p1;
        const anchor = i === 0 ? aSnap.p1 : aSnap.p0;

        const proj = projectOnInfiniteLine(e, bSnap.p0, bSnap.dir);

        // Strict containment in b's extent — no junction outside b.
        if (proj.t < 0 || proj.t > bSnap.length) continue;

        // Trigger: e is within (halfStroke + BORDER_PROXIMITY_PX) of b's
        // median. This covers e OUTSIDE b but within BORDER_PROXIMITY_PX
        // of the nearest border, AND e INSIDE b's stroke at any depth.
        if (proj.perpDist >= halfStroke + BORDER_PROXIMITY_PX) continue;

        // Distance from e to b's nearest border.
        const borderDist = Math.abs(proj.perpDist - halfStroke);

        // Sign of the snap target line:
        //   - V junction LOSER → ANCHOR's side (terminate cleanly at the
        //     side from which a's body approaches the corner);
        //   - close to a border → e's CURRENT side (pull to nearest border);
        //   - deep inside b → ANCHOR's side ("touch but don't traverse").
        // Edge case at the median (perpDist ≈ 0): use anchor's side either
        // way (e's side is undefined).
        const sideAnchor = signedSideOfLine(anchor, bSnap.p0, bSnap.dir);
        const isStickOut = stickOutEndpoints.has(`${aIdx}:${i}`);
        const isTuckInside = tuckInsideEndpoints.has(`${aIdx}:${i}`);
        let sign;
        if (isTuckInside) {
          sign = sideAnchor;
        } else if (borderDist < BORDER_PROXIMITY_PX) {
          sign =
            proj.perpDist < 1e-6
              ? sideAnchor
              : signedSideOfLine(e, bSnap.p0, bSnap.dir);
        } else {
          sign = sideAnchor;
        }

        // V junction WINNER → snap 1 px OUTSIDE the nearest border on e's
        // side (instead of 1 px inside). Otherwise snap target is 1 px
        // INSIDE the border (LOSER and regular case).
        const targetOffsetMagnitude = isStickOut
          ? halfStroke + SNAP_DEPTH_PX
          : Math.max(0, halfStroke - SNAP_DEPTH_PX);

        // Intersection of a's original direction line with the snap target
        // line. a's line: P(s) = anchor + s * aSnap.dir. b's target line:
        // (P - bSnap.p0) · perpDirB = sign * targetOffsetMagnitude.
        const denom = aSnap.dir.x * perpDirB.x + aSnap.dir.y * perpDirB.y;
        if (Math.abs(denom) < 1e-9) continue; // shouldn't happen given perpendicularity
        const targetSignedOffset = sign * targetOffsetMagnitude;
        const numer =
          targetSignedOffset -
          ((anchor.x - bSnap.p0.x) * perpDirB.x +
            (anchor.y - bSnap.p0.y) * perpDirB.y);
        const sParam = numer / denom;
        const newX = anchor.x + sParam * aSnap.dir.x;
        const newY = anchor.y + sParam * aSnap.dir.y;

        a.points[i] = { ...a.points[i], x: newX, y: newY };
      }
    }
  }

  // Refresh dir/length after snap (length may change; dir stays since the
  // endpoint moved along the original direction line — recompute defensively).
  for (const idx of aliveIndices) {
    const s = state[idx];
    const refreshed = makeDir(s.points[0], s.points[1]);
    s.dir = refreshed.dir;
    s.length = refreshed.length;
  }

  // 4. Unify coincident endpoint ids.
  const allPoints = [];
  for (const idx of aliveIndices) {
    for (let i = 0; i < 2; i++) {
      allPoints.push({
        segIdx: idx,
        pointIdx: i,
        point: state[idx].points[i],
      });
    }
  }

  const grouped = new Array(allPoints.length).fill(-1);
  for (let i = 0; i < allPoints.length; i++) {
    if (grouped[i] >= 0) continue;
    const groupId = i;
    grouped[i] = groupId;
    const pi = allPoints[i].point;
    const members = [i];
    for (let j = i + 1; j < allPoints.length; j++) {
      if (grouped[j] >= 0) continue;
      const pj = allPoints[j].point;
      if (Math.hypot(pi.x - pj.x, pi.y - pj.y) <= COINCIDENT_TOL_PX) {
        grouped[j] = groupId;
        members.push(j);
      }
    }
    if (members.length < 2) continue;
    members.sort((a, b) => {
      const sa = state[allPoints[a].segIdx];
      const sb = state[allPoints[b].segIdx];
      if (sa.id < sb.id) return -1;
      if (sa.id > sb.id) return 1;
      return allPoints[a].pointIdx - allPoints[b].pointIdx;
    });
    const sharedId = allPoints[members[0]].point.id;
    for (let k = 1; k < members.length; k++) {
      allPoints[members[k]].point.id = sharedId;
    }
  }

  // 5. Build updates / deleteIds.
  const updates = [];
  const deleteIds = [];
  for (let i = 0; i < state.length; i++) {
    const s = state[i];
    if (!s.alive) {
      deleteIds.push(s.id);
      continue;
    }
    const newPoints = s.points.map((p, idx) => {
      const orig = s.originalPoints?.[idx];
      const out = { id: p.id, x: p.x, y: p.y };
      if (orig?.type !== undefined) out.type = orig.type;
      else if (p.type !== undefined) out.type = p.type;
      return out;
    });
    const original = segments[i].points;
    const changed =
      original.length !== newPoints.length ||
      original.some(
        (op, k) =>
          op.id !== newPoints[k].id ||
          op.x !== newPoints[k].x ||
          op.y !== newPoints[k].y
      );
    if (changed) {
      updates.push({ id: s.id, points: newPoints });
    }
  }

  return { updates, deleteIds };
}
