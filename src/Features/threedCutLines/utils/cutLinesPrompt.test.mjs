import assert from "node:assert/strict";
import { test } from "node:test";

import buildCutLinesPromptContext, {
  CUT_LINES_PROMPT_MODES,
} from "./buildCutLinesPromptContext.js";
import buildCutLinesPromptMarkdown from "./buildCutLinesPromptMarkdown.js";
import parseCutLinesPromptResult from "./parseCutLinesPromptResult.js";

const v = (x, y, z) => ({ x, y, z });
const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

// Horizontal 6 × 4 m slab at altitude 0 (scene frame: Y up).
const slabRegion = {
  annotationId: "a1",
  label: "Dalle",
  faces: [
    {
      contour: [v(0, 0, 0), v(6, 0, 0), v(6, 0, 4), v(0, 0, 4)],
      holes: [],
      normal: v(0, -1, 0),
    },
  ],
};
// Wall standing on the x = 0 edge of the slab, 3 m high.
const wallRegion = {
  annotationId: "a2",
  label: "Voile",
  faces: [
    {
      contour: [v(0, 0, 0), v(0, 0, 4), v(0, 3, 4), v(0, 3, 0)],
      holes: [],
      normal: v(1, 0, 0),
    },
  ],
};

const build = (overrides = {}) =>
  buildCutLinesPromptContext({
    regions: [slabRegion, wallRegion],
    cutLines: [],
    maxArea: 4,
    ...overrides,
  });

const idOf = (built, p) =>
  Object.keys(built.vertexById).find((id) => {
    const q = built.vertexById[id];
    return Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 1e-6;
  });

test("context names the vertices once and describes the planar faces", () => {
  const built = build();
  const { context, stats } = built;
  // 4 slab corners + 2 wall top corners (the foot is shared).
  assert.equal(Object.keys(context.vertices).length, 6);
  assert.equal(context.faces.length, 2);
  assert.equal(stats.facesToCut, 2);

  const [slab, wall] = context.faces;
  assert.equal(slab.orientation, "horizontal");
  near(slab.area, 24);
  assert.equal(slab.needsCut, true);
  assert.equal(slab.contour.length, 4);
  assert.equal(slab.edges.length, 4);
  assert.deepEqual(slab.edges.map((e) => e.length).sort(), [4, 4, 6, 6]);
  assert.equal(Object.keys(slab.uv).length, 4);

  assert.equal(wall.orientation, "vertical");
  near(wall.area, 12);
  // The wall foot reuses the slab corners.
  assert.ok(wall.contour.includes(idOf(built, v(0, 0, 0))));
  assert.ok(wall.contour.includes(idOf(built, v(0, 0, 4))));
  assert.equal(context.curvedSurfaces, undefined);
});

test("existing cut lines are named and their segments become edges", () => {
  const built = build({
    cutLines: [{ id: "x", points: [v(3, 0, 0), v(3, 0, 4)] }],
  });
  const [line] = built.context.existingCutLines;
  assert.equal(line.id, "L1");
  assert.equal(line.points.length, 2);
  const parsed = parseCutLinesPromptResult({
    json: {
      cutLines: [
        {
          points: [
            { edge: line.points, distance: 2 },
            { vertex: idOf(built, v(6, 0, 4)) },
          ],
        },
      ],
    },
    vertexById: built.vertexById,
    edgeKeys: built.edgeKeys,
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.warnings, []);
  near(parsed.lines[0].points[0].z, 2);
});

test("curved regions are listed in GLB mode only", () => {
  const curved = {
    annotationId: "a3",
    label: "Coque",
    meshName: "coque__a3",
    shell: { surface: 31.4159 },
  };
  const text = build({ regions: [slabRegion, curved] });
  assert.equal(text.context.curvedSurfaces, undefined);
  assert.equal(text.stats.curvedCount, 1);
  const glb = build({
    regions: [slabRegion, curved],
    mode: CUT_LINES_PROMPT_MODES.GLB,
  });
  assert.deepEqual(glb.context.curvedSurfaces, [
    { id: "C1", annotation: "Coque", mesh: "coque__a3", area: 31.416 },
  ]);
});

test("an edge point resolves on the segment and gets a cote", () => {
  const built = build();
  const a = idOf(built, v(0, 0, 0));
  const b = idOf(built, v(6, 0, 0));
  const c = idOf(built, v(0, 0, 4));
  const d = idOf(built, v(6, 0, 4));
  const parsed = parseCutLinesPromptResult({
    json: {
      cutLines: [
        {
          points: [
            { edge: [a, b], distance: 2 },
            { edge: [c, d], distance: 2 },
          ],
        },
        // Same start point: its cote is not repeated.
        { points: [{ edge: [a, b], distance: 2 }, { vertex: d }] },
        // Corner to corner: no cote.
        { points: [{ vertex: a }, { vertex: d }] },
        // Distance = edge length: a corner, no cote.
        { points: [{ edge: [a, b], distance: 6 }, { vertex: c }] },
      ],
      note: "ok",
    },
    vertexById: built.vertexById,
    edgeKeys: built.edgeKeys,
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.note, "ok");
  assert.equal(parsed.lines.length, 4);
  assert.deepEqual(parsed.lines[0].points, [v(2, 0, 0), v(2, 0, 4)]);
  assert.equal(parsed.cotes.length, 2);
  assert.deepEqual(parsed.cotes[0], { a: v(0, 0, 0), b: v(2, 0, 0) });
  assert.deepEqual(parsed.cotes[1], { a: v(0, 0, 4), b: v(2, 0, 4) });
  assert.deepEqual(parsed.warnings, []);
});

test("invalid references drop the line with a warning", () => {
  const built = build();
  const a = idOf(built, v(0, 0, 0));
  const b = idOf(built, v(6, 0, 0));
  const d = idOf(built, v(6, 0, 4));
  const parsed = parseCutLinesPromptResult({
    json: {
      cutLines: [
        { points: [{ vertex: "S99" }, { vertex: a }] },
        { points: [{ edge: [a, b], distance: 7 }, { vertex: d }] },
        { points: [{ vertex: a }] },
        { points: [{ vertex: a }, { vertex: a }] },
        // Not a known edge (diagonal): kept, with a warning.
        { points: [{ edge: [a, d], distance: 1 }, { vertex: b }] },
      ],
    },
    vertexById: built.vertexById,
    edgeKeys: built.edgeKeys,
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.warnings.length, 5);
  assert.match(parsed.warnings[0], /sommet inconnu/);
  assert.match(parsed.warnings[1], /hors de l’arête/);
  assert.match(parsed.warnings[4], /pas une arête connue/);
});

test("raw coordinates are refused in text mode, accepted in GLB mode", () => {
  const built = build();
  const a = idOf(built, v(0, 0, 0));
  const json = {
    cutLines: [{ points: [{ vertex: a }, [3, 0, 2]] }],
    cotes: [
      { a: { vertex: a }, b: [3, 0, 2] },
      { a: [3, 0, 2], b: { vertex: a } },
    ],
  };
  const text = parseCutLinesPromptResult({
    json,
    vertexById: built.vertexById,
    edgeKeys: built.edgeKeys,
  });
  assert.equal(text.ok, false);
  assert.match(text.error, /refusées en mode texte/);

  const glb = parseCutLinesPromptResult({
    json,
    vertexById: built.vertexById,
    edgeKeys: built.edgeKeys,
    mode: CUT_LINES_PROMPT_MODES.GLB,
  });
  assert.equal(glb.ok, true);
  assert.deepEqual(glb.lines[0].points, [v(0, 0, 0), v(3, 0, 2)]);
  // The two cotes of the answer are the same segment.
  assert.equal(glb.cotes.length, 1);
});

test("a result without cutLines is not ok", () => {
  const parsed = parseCutLinesPromptResult({ json: { lines: [] } });
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /cutLines/);
});

test("markdown fills the max surface and embeds the context", () => {
  const { context } = build();
  const text = buildCutLinesPromptMarkdown({
    instructions: "# Titre\n\nMax {{MAX_AREA}} m², soit {{MAX_AREA}}.",
    context,
  });
  assert.match(text, /Max 4 m², soit 4\./);
  const json = JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(json.faces.length, 2);
  const bare = buildCutLinesPromptMarkdown({
    instructions: "Max {{MAX_AREA}}",
    context,
    embedContext: false,
  });
  assert.equal(bare, "Max 4\n");
});
