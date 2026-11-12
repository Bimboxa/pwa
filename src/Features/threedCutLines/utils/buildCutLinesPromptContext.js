import computeFaceArea from "../../threedMesh/utils/computeFaceArea.js";
import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";
import { projectPointTo2d } from "../../threedMesh/utils/planeProjection.js";

export const CUT_LINES_PROMPT_MODES = { TEXT: "TEXT", GLB: "GLB" };

// Two points closer than this (meters) are the same named vertex.
const WELD_M = 1e-3;
// |normal · up| above / below which a face is called horizontal / vertical.
const HORIZONTAL_DOT = 0.95;
const VERTICAL_DOT = 0.05;

const round3 = (v) => Math.round(v * 1000) / 1000;
const toArray = (p) => [round3(p.x), round3(p.y), round3(p.z)];

// Key of the unordered pair of two vertex ids.
export function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Context handed to the AI chat by « Ligne de coupe – prompt IA »: the
// planar faces of the visible annotations with NAMED vertices (S1, S2…), so
// that the answer references corners and points on edges instead of
// coordinates, and the cut lines already drawn.
//
//   regions: [{ annotationId, label, faces?: [{ contour, holes, normal }],
//               shell?: { surface } }] — world meters (scene frame, Y up),
//               one entry per face region (collectCutLinesPromptRegions);
//   cutLines: [{ id, points: [{x,y,z}] }] — the rendered cut lines;
//   maxArea: target max surface of a maille (m²);
//   mode: TEXT (planar faces only) | GLB (curved surfaces listed, their
//         geometry travels in scene.glb).
//
// Returns { context, vertexById, edgeKeys, stats } — `context` is the JSON
// given to the chat; `vertexById` (id → {x,y,z}, unrounded) and `edgeKeys`
// (Set of edgeKey) resolve the answer (parseCutLinesPromptResult).
//
// Pure, node-tested.
export default function buildCutLinesPromptContext({
  regions,
  cutLines,
  maxArea,
  mode = CUT_LINES_PROMPT_MODES.TEXT,
}) {
  const vertexById = {};
  const idByKey = new Map();
  const edgeKeys = new Set();

  const weldKey = (p) =>
    `${Math.round(p.x / WELD_M)}|${Math.round(p.y / WELD_M)}|${Math.round(p.z / WELD_M)}`;
  const nameVertex = (p) => {
    const key = weldKey(p);
    let id = idByKey.get(key);
    if (!id) {
      id = `S${idByKey.size + 1}`;
      idByKey.set(key, id);
      vertexById[id] = { x: p.x, y: p.y, z: p.z };
    }
    return id;
  };

  const faces = [];
  const curvedSurfaces = [];
  let facesToCut = 0;

  for (const region of regions || []) {
    if (region.shell) {
      curvedSurfaces.push({
        id: `C${curvedSurfaces.length + 1}`,
        annotation: region.label || "",
        ...(region.meshName ? { mesh: region.meshName } : {}),
        area: round3(region.shell.surface ?? 0),
      });
      continue;
    }
    for (const face of region.faces || []) {
      if (!face?.contour || face.contour.length < 3) continue;
      const area = computeFaceArea(face);
      if (!(area > 0)) continue;
      const basis = computePlaneBasis(face.normal, face.contour[0]);
      const uv = {};
      const edges = [];
      const nameLoop = (loop) => {
        const ids = loop.map((p) => {
          const id = nameVertex(p);
          const p2 = projectPointTo2d(p, basis);
          uv[id] = [round3(p2.x), round3(p2.y)];
          return id;
        });
        ids.forEach((from, i) => {
          const to = ids[(i + 1) % ids.length];
          if (from === to) return;
          const a = loop[i];
          const b = loop[(i + 1) % loop.length];
          edges.push({
            from,
            to,
            length: round3(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)),
          });
          edgeKeys.add(edgeKey(from, to));
        });
        return ids;
      };
      const contour = nameLoop(face.contour);
      const holes = (face.holes || []).map(nameLoop);
      const needsCut = area > maxArea;
      if (needsCut) facesToCut += 1;
      faces.push({
        id: `F${faces.length + 1}`,
        annotation: region.label || "",
        orientation: getOrientation(basis.n),
        area: round3(area),
        needsCut,
        contour,
        holes,
        uv,
        edges,
      });
    }
  }

  const existingCutLines = (cutLines || [])
    .filter((line) => line?.points?.length >= 2)
    .map((line, i) => {
      const ids = line.points.map(nameVertex);
      for (let k = 0; k + 1 < ids.length; k++) {
        if (ids[k] !== ids[k + 1]) edgeKeys.add(edgeKey(ids[k], ids[k + 1]));
      }
      return { id: `L${i + 1}`, points: ids };
    });

  const vertices = {};
  for (const [id, p] of Object.entries(vertexById)) vertices[id] = toArray(p);

  const isGlb = mode === CUT_LINES_PROMPT_MODES.GLB;
  const context = {
    unit: "m",
    up: "y",
    maxArea,
    vertices,
    faces,
    ...(isGlb ? { curvedSurfaces } : {}),
    existingCutLines,
  };

  return {
    context,
    vertexById,
    edgeKeys,
    stats: {
      faceCount: faces.length,
      facesToCut,
      curvedCount: curvedSurfaces.length,
      cutLineCount: existingCutLines.length,
    },
  };
}

function getOrientation(n) {
  const up = Math.abs(n.y);
  if (up > HORIZONTAL_DOT) return "horizontal";
  if (up < VERTICAL_DOT) return "vertical";
  return "incline";
}
