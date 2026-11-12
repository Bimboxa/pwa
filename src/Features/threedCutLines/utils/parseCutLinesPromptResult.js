import {
  CUT_LINES_PROMPT_MODES,
  edgeKey,
} from "./buildCutLinesPromptContext.js";

// Two resolved points closer than this (meters) are the same point.
const SAME_POINT_M = 1e-3;

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const samePoint = (a, b) => distance(a, b) < SAME_POINT_M;

// Answer of the AI chat to « Ligne de coupe – prompt IA », resolved to world
// points:
//
//   { "cutLines": [{ "points": [ <point>, <point>, … ] }],
//     "cotes": [{ "a": <point>, "b": <point> }],   // optional
//     "note": "…" }
//
//   <point> = { "vertex": "S3" }                        a named corner
//           | { "edge": ["S7", "S8"], "distance": 1.5 } on the segment S7 →
//                                                       S8, 1.5 m from S7
//           | [x, y, z]                                 world meters — GLB
//                                                       mode only
//
// A cote is added for every `edge` point (from its reference vertex to the
// point): a line that does not start from a corner must be set out on site.
// The `cotes` of the answer come on top (GLB mode: the model dimensions its
// free points itself). Cotes are de-duplicated.
//
// An invalid line / cote is dropped with a warning; the result is not ok
// when no line is left.
//
//   json: the parsed object (extractJsonText);
//   vertexById / edgeKeys: from buildCutLinesPromptContext;
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

  // → { point, cote? } or { error }
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
      return { point, warning, cote: { a: { ...from }, b: point } };
    }
    return { error: "point sans « vertex » ni « edge »" };
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

  json.cutLines.forEach((line, index) => {
    const label = `Ligne ${index + 1}`;
    const rawPoints = Array.isArray(line) ? line : line?.points;
    if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
      pushWarning(`${label} ignorée : au moins 2 points attendus`);
      return;
    }
    const points = [];
    const cotes = [];
    for (const raw of rawPoints) {
      const resolved = resolvePoint(raw);
      if (resolved.error) {
        pushWarning(`${label} ignorée : ${resolved.error}`);
        return;
      }
      pushWarning(resolved.warning && `${label} : ${resolved.warning}`);
      const last = points[points.length - 1];
      if (last && samePoint(last, resolved.point)) continue;
      points.push(resolved.point);
      if (resolved.cote) cotes.push(resolved.cote);
    }
    if (points.length < 2) {
      pushWarning(`${label} ignorée : points confondus`);
      return;
    }
    result.lines.push({ points });
    cotes.forEach(pushCote);
  });

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
