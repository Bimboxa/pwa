import {
  CUT_LINES_PROMPT_MODES,
  edgeKey,
} from "./buildCutLinesPromptContext.js";

// Two resolved points closer than this (meters) are the same point.
const SAME_POINT_M = 1e-3;
// A point closer than this (meters) to the plane of a face is on that face.
const ON_PLANE_M = 2e-3;
// Rise or run under this share of a segment's length: the segment is called
// horizontal / vertical (0.5 % ≈ 0.3°).
const DIAGONAL_RATIO = 5e-3;

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const samePoint = (a, b) => distance(a, b) < SAME_POINT_M;

// Answer of the AI chat to « Ligne de coupe – prompt IA », resolved to world
// points:
//
//   { "cutLines": [{ "id": "N1", "points": [ <point>, <point>, … ] }],
//     "cotes": [{ "a": <point>, "b": <point> }],   // optional
//     "note": "…" }
//
//   <point> = { "vertex": "S3" }                        a named corner
//           | { "edge": ["S7", "S8"], "distance": 1.5 } on the segment S7 →
//                                                       S8, 1.5 m from S7
//           | { "line": "N1", "distance": 2 }           on the line N1 OF
//                                                       THE ANSWER, 2 m from
//                                                       its first point
//           | [x, y, z]                                 world meters — GLB
//                                                       mode only
//
// A line that does not start from a corner must be set out on site, so the
// `edge` / `line` points get cotes. They are CHAINED, never stacked: along
// one edge (or one line) the points are sorted from the reference corner
// and each one is dimensioned from the previous one — the first from the
// corner (the first vertex of the first reference to that edge, or the
// first point of the line). The `cotes` of the answer come on top (GLB
// mode: the model dimensions its free points itself). Cotes are
// de-duplicated.
//
// A line with a diagonal segment on a vertical face (neither horizontal nor
// vertical) is refused: such a line cannot be set out with a level.
//
// An invalid line / cote is dropped with a warning; the result is not ok
// when no line is left.
//
//   json: the parsed object (extractJsonText);
//   vertexById / edgeKeys / verticalFaces: from buildCutLinesPromptContext;
//   mode: TEXT | GLB.
//
// Returns { ok, error, lines: [{ points: [{x,y,z}] }],
//           cotes: [{ a, b }], warnings: [string], note }.
//
// Pure, node-tested.
export default function parseCutLinesPromptResult({
  json,
  vertexById,
  edgeKeys,
  verticalFaces,
  mode = CUT_LINES_PROMPT_MODES.TEXT,
}) {
  const result = {
    ok: false,
    error: null,
    lines: [],
    cotes: [],
    warnings: [],
    note: typeof json?.note === "string" ? json.note : null,
  };
  if (!json || typeof json !== "object" || !Array.isArray(json.cutLines)) {
    result.error = "La clé « cutLines » (tableau) est absente du résultat.";
    return result;
  }
  const allowXyz = mode === CUT_LINES_PROMPT_MODES.GLB;

  // Lines of the answer, by id, once resolved: { points, length }.
  const linesById = new Map();
  const declaredLineIds = new Set(
    json.cutLines.map((line) => getLineId(line)).filter(Boolean)
  );
  // Set-out points per edge / line: key → { origin, originId, entries }.
  const chains = new Map();

  // → { point, warning?, anchor? }, { defer } (line not resolved yet) or
  //   { error }. `anchor` = { key, origin, originId?, d, length } for a
  //   point to set out: `d` meters from `origin` along the edge / line `key`.
  function resolvePoint(raw) {
    if (Array.isArray(raw)) {
      if (raw.length !== 3 || !raw.every(isFiniteNumber)) {
        return { error: "point [x, y, z] invalide" };
      }
      if (!allowXyz) {
        return {
          error:
            "coordonnées [x, y, z] refusées en mode texte (utiliser « vertex » ou « edge »)",
        };
      }
      return { point: { x: raw[0], y: raw[1], z: raw[2] } };
    }
    if (!raw || typeof raw !== "object") return { error: "point invalide" };

    if (raw.vertex !== undefined) {
      const p = vertexById?.[raw.vertex];
      if (!p) return { error: `sommet inconnu « ${raw.vertex} »` };
      return { point: { ...p } };
    }

    if (raw.edge !== undefined) {
      const [fromId, toId] = Array.isArray(raw.edge) ? raw.edge : [];
      const from = vertexById?.[fromId];
      const to = vertexById?.[toId];
      if (!from || !to || fromId === toId) {
        return { error: `arête invalide « ${JSON.stringify(raw.edge)} »` };
      }
      if (!isFiniteNumber(raw.distance)) {
        return { error: `distance manquante sur l’arête ${fromId} → ${toId}` };
      }
      const len = distance(from, to);
      if (raw.distance < -SAME_POINT_M || raw.distance > len + SAME_POINT_M) {
        return {
          error: `distance ${raw.distance} m hors de l’arête ${fromId} → ${toId} (${len.toFixed(3)} m)`,
        };
      }
      const d = Math.min(len, Math.max(0, raw.distance));
      const t = len > 0 ? d / len : 0;
      const point = {
        x: from.x + t * (to.x - from.x),
        y: from.y + t * (to.y - from.y),
        z: from.z + t * (to.z - from.z),
      };
      const warning = edgeKeys?.has(edgeKey(fromId, toId))
        ? null
        : `${fromId} → ${toId} n’est pas une arête connue : point pris sur le segment`;
      // On one of the two corners: nothing to set out.
      if (samePoint(point, from) || samePoint(point, to)) {
        return { point, warning };
      }
      return {
        point,
        warning,
        anchor: {
          key: edgeKey(fromId, toId),
          originId: fromId,
          origin: { ...from },
          d,
          length: len,
        },
      };
    }

    if (raw.line !== undefined) {
      const line = linesById.get(raw.line);
      if (!line) {
        return declaredLineIds.has(raw.line)
          ? { defer: raw.line }
          : { error: `ligne inconnue « ${raw.line} »` };
      }
      if (!isFiniteNumber(raw.distance)) {
        return { error: `distance manquante sur la ligne ${raw.line}` };
      }
      if (
        raw.distance < -SAME_POINT_M ||
        raw.distance > line.length + SAME_POINT_M
      ) {
        return {
          error: `distance ${raw.distance} m hors de la ligne ${raw.line} (${line.length.toFixed(3)} m)`,
        };
      }
      const d = Math.min(line.length, Math.max(0, raw.distance));
      const point = pointAlong(line.points, d);
      const first = line.points[0];
      const last = line.points[line.points.length - 1];
      if (samePoint(point, first) || samePoint(point, last)) return { point };
      return {
        point,
        anchor: {
          key: `line:${raw.line}`,
          origin: { ...first },
          d,
          length: line.length,
        },
      };
    }
    return { error: "point sans « vertex », « edge » ni « line »" };
  }

  const coteKeys = new Set();
  const pointKey = (p) =>
    `${Math.round(p.x * 1000)}|${Math.round(p.y * 1000)}|${Math.round(p.z * 1000)}`;
  function pushCote(cote) {
    if (samePoint(cote.a, cote.b)) return;
    const [k1, k2] = [pointKey(cote.a), pointKey(cote.b)].sort();
    const key = `${k1}>${k2}`;
    if (coteKeys.has(key)) return;
    coteKeys.add(key);
    result.cotes.push(cote);
  }
  const pushWarning = (message) => {
    if (message && !result.warnings.includes(message)) {
      result.warnings.push(message);
    }
  };

  // → "done" | "deferred" (references a line of the answer not resolved yet).
  function resolveLine(line, index, isLastPass) {
    const label = `Ligne ${index + 1}`;
    const rawPoints = Array.isArray(line) ? line : line?.points;
    if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
      pushWarning(`${label} ignorée : au moins 2 points attendus`);
      return "done";
    }
    const resolvedPoints = [];
    for (const raw of rawPoints) {
      const resolved = resolvePoint(raw);
      if (resolved.defer && !isLastPass) return "deferred";
      const error = resolved.defer
        ? `la ligne « ${resolved.defer} » n’a pas pu être résolue`
        : resolved.error;
      if (error) {
        pushWarning(`${label} ignorée : ${error}`);
        return "done";
      }
      resolvedPoints.push(resolved);
    }
    const points = [];
    const anchors = [];
    const warnings = [];
    for (const resolved of resolvedPoints) {
      if (resolved.warning) warnings.push(`${label} : ${resolved.warning}`);
      const last = points[points.length - 1];
      if (last && samePoint(last, resolved.point)) continue;
      points.push(resolved.point);
      if (resolved.anchor)
        anchors.push({ ...resolved.anchor, point: resolved.point });
    }
    if (points.length < 2) {
      pushWarning(`${label} ignorée : points confondus`);
      return "done";
    }
    if (hasDiagonalOnVerticalFace(points, verticalFaces)) {
      pushWarning(
        `${label} ignorée : diagonale sur un plan vertical (lignes horizontales ou verticales uniquement)`
      );
      return "done";
    }
    warnings.forEach(pushWarning);
    result.lines.push({ points });
    const id = getLineId(line);
    if (id && !linesById.has(id)) {
      linesById.set(id, { points, length: polylineLength(points) });
    }
    for (const anchor of anchors) {
      let chain = chains.get(anchor.key);
      if (!chain) {
        chain = {
          origin: anchor.origin,
          originId: anchor.originId,
          entries: [],
        };
        chains.set(anchor.key, chain);
      }
      // The chain starts from the corner of the first reference to the edge:
      // a later reference from the other corner is measured back from it.
      const s =
        anchor.originId === chain.originId
          ? anchor.d
          : anchor.length - anchor.d;
      chain.entries.push({ s, point: anchor.point });
    }
    return "done";
  }

  // A line may reference a line declared after it: retry until no progress.
  let pending = json.cutLines.map((line, index) => ({ line, index }));
  while (pending.length) {
    const deferred = pending.filter(
      ({ line, index }) => resolveLine(line, index, false) === "deferred"
    );
    if (deferred.length === pending.length) {
      deferred.forEach(({ line, index }) => resolveLine(line, index, true));
      break;
    }
    pending = deferred;
  }

  // Chained set-out cotes: corner → 1st point → 2nd point → …
  for (const chain of chains.values()) {
    let previous = chain.origin;
    for (const entry of [...chain.entries].sort((a, b) => a.s - b.s)) {
      if (samePoint(previous, entry.point)) continue;
      pushCote({ a: previous, b: entry.point });
      previous = entry.point;
    }
  }

  if (Array.isArray(json.cotes)) {
    json.cotes.forEach((cote, index) => {
      const a = resolvePoint(cote?.a);
      const b = resolvePoint(cote?.b);
      const error = a.error || b.error;
      if (error) {
        pushWarning(`Cote ${index + 1} ignorée : ${error}`);
        return;
      }
      pushCote({ a: a.point, b: b.point });
    });
  }

  if (!result.lines.length) {
    result.error =
      result.warnings[0] ?? "Aucune ligne de coupe dans le résultat.";
    return result;
  }
  result.ok = true;
  return result;
}

function getLineId(line) {
  const id = Array.isArray(line) ? null : line?.id;
  return typeof id === "string" && id ? id : null;
}

function polylineLength(points) {
  let length = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    length += distance(points[i], points[i + 1]);
  }
  return length;
}

// Point of the polyline at `d` meters (along it) from its first point.
function pointAlong(points, d) {
  let left = d;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = distance(a, b);
    if (left <= len || i + 2 === points.length) {
      const t = len > 0 ? Math.min(1, left / len) : 0;
      return {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
        z: a.z + t * (b.z - a.z),
      };
    }
    left -= len;
  }
  return { ...points[points.length - 1] };
}

// True when a segment of the polyline lies ON a vertical face and is neither
// horizontal nor vertical.
//   verticalFaces: [{ origin, u, v, n, contour, holes }] — plane basis and
//   2D loops (buildCutLinesPromptContext).
function hasDiagonalOnVerticalFace(points, verticalFaces) {
  if (!verticalFaces?.length) return false;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const rise = Math.abs(b.y - a.y);
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    const tol = Math.max(ON_PLANE_M, DIAGONAL_RATIO * distance(a, b));
    if (rise <= tol || run <= tol) continue;
    const mid = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    };
    for (const face of verticalFaces) {
      if (Math.abs(planeOffset(a, face)) > ON_PLANE_M) continue;
      if (Math.abs(planeOffset(b, face)) > ON_PLANE_M) continue;
      const p = to2d(mid, face);
      if (!isInsideLoop(p, face.contour)) continue;
      if ((face.holes || []).some((hole) => isInsideLoop(p, hole))) continue;
      return true;
    }
  }
  return false;
}

const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const planeOffset = (p, face) => dot3(sub3(p, face.origin), face.n);
const to2d = (p, face) => {
  const d = sub3(p, face.origin);
  return { x: dot3(d, face.u), y: dot3(d, face.v) };
};

function isInsideLoop(p, loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}
