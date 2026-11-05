import assert from "node:assert/strict";
import { test } from "node:test";

import buildHostPartIndex from "./buildHostPartIndex.js";
import listHostEdgeParts from "./listHostEdgeParts.js";
import listHostFaceParts from "./listHostFaceParts.js";
import { localGeometryToPaint } from "./meshPaintFrame.js";
import { flipFace } from "./meshPaintGeometry.js";
import {
  METRICS,
  boxTriangles,
  quadTriangles,
  storedEdge,
  v,
} from "./meshPaintTestFixtures.mjs";
import planPaintAllParts from "./planPaintAllParts.js";

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

const AXES = {
  top: v(0, 0, 1),
  bottom: v(0, 0, -1),
  front: v(0, -1, 0),
  right: v(1, 0, 0),
};

// A closed box host and its six outward faces.
const box = () => {
  const index = buildHostPartIndex({
    triangles: boxTriangles(v(0, 0, 0), v(2, 1, 3)),
  });
  const { parts, isClosed } = listHostFaceParts(index);
  const indexOf = (name) =>
    parts.findIndex((part) => dot(part.normal, AXES[name]) > 0.99);
  return { parts, isClosed, indexOf };
};

let nextId = 0;
const faceRow = (localFace, templateId, extra = {}) => ({
  id: `row${nextId++}`,
  partType: "FACE",
  baseMapId: "bm1",
  hostAnnotationId: "h1",
  annotationTemplateId: templateId,
  geometry: localGeometryToPaint("FACE", localFace, METRICS),
  ...extra,
});

const plan = ({ parts, isClosed }, clickedIndex, rows = [], extra = {}) =>
  planPaintAllParts({
    parts,
    clickedIndex,
    clickedPart: parts[clickedIndex],
    isClosed,
    hostId: "h1",
    baseMapId: "bm1",
    rows,
    metrics: METRICS,
    templateId: "t1",
    ...extra,
  });

test("bare box: one click paints the six faces, the clicked one first", () => {
  const host = box();
  const result = plan(host, host.indexOf("top"));
  assert.equal(result.action, "ADDED");
  assert.equal(result.add.length, 6);
  assert.equal(result.add[0].localGeometry, host.parts[host.indexOf("top")]);
  assert.deepEqual(result.deleteIds, []);
  assert.ok(result.add.every((item) => item.geometry?.polygons?.length === 1));
});

test("a face already painted with the armed template is left alone", () => {
  const host = box();
  const rows = [faceRow(host.parts[host.indexOf("top")], "t1")];
  const result = plan(host, host.indexOf("front"), rows);
  assert.equal(result.action, "ADDED");
  assert.equal(result.add.length, 5);
  assert.deepEqual(result.deleteIds, []);
  assert.ok(
    result.add.every((item) => dot(item.localGeometry.normal, AXES.top) < 0.5)
  );
});

test("another template's paint is kept unless it is the clicked face", () => {
  const host = box();
  const other = faceRow(host.parts[host.indexOf("top")], "t2");

  const beside = plan(host, host.indexOf("front"), [other]);
  assert.equal(beside.action, "ADDED");
  assert.equal(beside.add.length, 5);
  assert.deepEqual(beside.deleteIds, []);

  const onIt = plan(host, host.indexOf("top"), [other]);
  assert.equal(onIt.action, "REPLACED");
  assert.equal(onIt.add.length, 6);
  assert.deepEqual(onIt.deleteIds, [other.id]);
  assert.deepEqual(onIt.removeRows, [other]);
});

test("a click on a face of the armed template removes all its faces", () => {
  const host = box();
  const top = faceRow(host.parts[host.indexOf("top")], "t1");
  const front = faceRow(host.parts[host.indexOf("front")], "t1");
  const otherTemplate = faceRow(host.parts[host.indexOf("right")], "t2");
  const otherHost = faceRow(
    {
      polygons: [
        {
          contour: [v(5, 0, 0), v(6, 0, 0), v(6, 1, 0), v(5, 1, 0)],
          holes: [],
        },
      ],
      normal: v(0, 0, 1),
    },
    "t1",
    { hostAnnotationId: "h2" }
  );
  const edge = {
    id: "edge",
    partType: "EDGE",
    baseMapId: "bm1",
    hostAnnotationId: "h1",
    annotationTemplateId: "t1",
    geometry: storedEdge(v(0, 0, 3), v(2, 0, 3)),
  };
  const result = plan(host, host.indexOf("top"), [
    top,
    front,
    otherTemplate,
    otherHost,
    edge,
  ]);
  assert.equal(result.action, "REMOVED");
  assert.deepEqual(result.add, []);
  assert.deepEqual([...result.deleteIds].sort(), [top.id, front.id].sort());
});

test("open sheet: a face painted on its other side is not painted twice", () => {
  // Floor z = 0 + wall x = 0 sharing an edge (an L).
  const triangles = [];
  quadTriangles(v(0, 0, 0), v(2, 0, 0), v(2, 2, 0), v(0, 2, 0), triangles);
  quadTriangles(v(0, 0, 0), v(0, 2, 0), v(0, 2, 2), v(0, 0, 2), triangles);
  const index = buildHostPartIndex({ triangles });
  const clickedFace = {
    polygons: [
      { contour: [v(0, 0, 0), v(2, 0, 0), v(2, 2, 0), v(0, 2, 0)], holes: [] },
    ],
    normal: v(0, 0, 1),
  };
  const host = listHostFaceParts(index, { clickedFace });
  assert.equal(host.isClosed, false);
  const wall = host.parts.find((part) => Math.abs(part.normal.x) > 0.99);
  assert.ok(wall.normal.x > 0.99);

  const bare = plan(host, host.clickedIndex);
  assert.equal(bare.add.length, 2);

  // The back of the wall (-x) already carries the armed template.
  const back = faceRow(flipFace(wall), "t1");
  const result = plan(host, host.clickedIndex, [back]);
  assert.equal(result.action, "ADDED");
  assert.equal(result.add.length, 1);
  assert.ok(result.add[0].localGeometry.normal.z > 0.99);

  // Another template on the back does not block the front.
  const backOther = faceRow(flipFace(wall), "t2");
  assert.equal(plan(host, host.clickedIndex, [backOther]).add.length, 2);
});

test("two faces of the batch at the same place make one row", () => {
  const contour = [v(0, 0, 0), v(2, 0, 0), v(2, 2, 0), v(0, 2, 0)];
  const index = buildHostPartIndex({
    triangles: quadTriangles(...contour),
    // The same face stored twice, back to back (isMesh3d host).
    exactFaces: [
      { contour, holes: [] },
      { contour: [...contour].reverse(), holes: [] },
    ],
  });
  const host = listHostFaceParts(index, {
    clickedFace: { polygons: [{ contour, holes: [] }], normal: v(0, 0, 1) },
  });
  assert.equal(host.parts.length, 2);
  const result = plan(host, host.clickedIndex);
  assert.equal(result.action, "ADDED");
  assert.equal(result.add.length, 1);
  assert.ok(result.add[0].localGeometry.normal.z > 0.99);
});

test("too many faces: nothing is planned", () => {
  const host = box();
  const result = plan(host, host.indexOf("top"), [], { maxParts: 5 });
  assert.equal(result.tooMany, true);
  assert.deepEqual(result.add, []);
  assert.equal(result.action, null);
});

// --- edges (« Peindre toutes les arêtes de l'annotation ») ---

// The twelve edges of the closed box host.
const boxEdges = () =>
  listHostEdgeParts(
    buildHostPartIndex({ triangles: boxTriangles(v(0, 0, 0), v(2, 1, 3)) })
  ).parts;

const edgeRow = (localEdge, templateId, extra = {}) => ({
  id: `row${nextId++}`,
  partType: "EDGE",
  baseMapId: "bm1",
  hostAnnotationId: "h1",
  annotationTemplateId: templateId,
  geometry: localGeometryToPaint("EDGE", localEdge, METRICS),
  ...extra,
});

const planEdges = (parts, clickedIndex, rows = [], extra = {}) =>
  planPaintAllParts({
    partType: "EDGE",
    parts,
    clickedIndex,
    clickedPart: parts[clickedIndex],
    hostId: "h1",
    baseMapId: "bm1",
    rows,
    metrics: METRICS,
    templateId: "t1",
    ...extra,
  });

test("edges: one click paints the twelve edges of a bare box", () => {
  const parts = boxEdges();
  assert.equal(parts.length, 12);
  const result = planEdges(parts, 0);
  assert.equal(result.action, "ADDED");
  assert.equal(result.add.length, 12);
  assert.equal(result.add[0].localGeometry, parts[0]);
  assert.ok(result.add.every((item) => item.geometry.points.length === 2));
});

test("edges: the picked edge is found among the host's, not doubled", () => {
  const parts = boxEdges();
  const result = planEdges(parts, -1, [], {
    clickedPart: { points: parts[4].points.map((p) => ({ ...p })) },
  });
  assert.equal(result.action, "ADDED");
  assert.equal(result.clickedIndex, 4);
  assert.equal(result.add.length, 12);
});

test("edges: painted edges are left alone, another host's included", () => {
  const parts = boxEdges();
  const own = edgeRow(parts[3], "t1");
  const other = edgeRow(parts[5], "t2");
  // The corner edge shared with a neighbor, painted on that neighbor.
  const shared = edgeRow(parts[7], "t1", { hostAnnotationId: "h2" });
  const result = planEdges(parts, 0, [own, other, shared]);
  assert.equal(result.action, "ADDED");
  assert.equal(result.add.length, 9);
  assert.deepEqual(result.deleteIds, []);
});

test("edges: a click on an edge of the armed template removes its edges only", () => {
  const parts = boxEdges();
  const first = edgeRow(parts[0], "t1");
  const second = edgeRow(parts[6], "t1");
  const otherTemplate = edgeRow(parts[2], "t2");
  const host = box();
  const face = faceRow(host.parts[host.indexOf("top")], "t1");
  const result = planEdges(parts, 0, [first, second, otherTemplate, face]);
  assert.equal(result.action, "REMOVED");
  assert.deepEqual(result.add, []);
  assert.deepEqual([...result.deleteIds].sort(), [first.id, second.id].sort());
});
