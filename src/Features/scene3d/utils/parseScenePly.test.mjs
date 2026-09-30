import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, openSync, readSync, statSync } from "node:fs";

import parseScenePly from "./parseScenePly.js";

// --- fixture: 2 quads (4 triangles) sharing an edge, one atlas each

function buildPly({ littleEndian = true, withUvs = true } = {}) {
  const vertices = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0.5],
    [0, 1, 0.5],
    [2, 0, 1],
    [2, 1, 1],
  ];
  // [indices, uvs (u, v pairs), texnumber]
  const faces = [
    [[0, 1, 2], [0, 0, 1, 0, 1, 1], 0],
    [[0, 2, 3], [0, 0, 1, 1, 0, 1], 0],
    [[1, 4, 5], [0, 0, 1, 0, 1, 1], 1],
    [[1, 5, 2], [0, 0, 1, 1, 0, 1], 1],
  ];
  const header = [
    "ply",
    `format ${littleEndian ? "binary_little_endian" : "binary_big_endian"} 1.0`,
    "comment TextureFile atlas_0.jpg",
    "comment TextureFile atlas_1.jpg",
    `element vertex ${vertices.length}`,
    "property float x",
    "property float y",
    "property float z",
    `element face ${faces.length}`,
    "property list uchar uint vertex_indices",
    ...(withUvs ? ["property list uchar float texcoord"] : []),
    "property int texnumber",
    "end_header",
    "",
  ].join("\n");
  const faceBytes = withUvs ? 1 + 12 + 1 + 24 + 4 : 1 + 12 + 4;
  const bytes = new Uint8Array(
    header.length + vertices.length * 12 + faces.length * faceBytes
  );
  bytes.set(new TextEncoder().encode(header));
  const view = new DataView(bytes.buffer);
  let o = header.length;
  for (const v of vertices) {
    for (const c of v) {
      view.setFloat32(o, c, littleEndian);
      o += 4;
    }
  }
  for (const [indices, uvs, tex] of faces) {
    view.setUint8(o++, 3);
    for (const i of indices) {
      view.setUint32(o, i, littleEndian);
      o += 4;
    }
    if (withUvs) {
      view.setUint8(o++, 6);
      for (const c of uvs) {
        view.setFloat32(o, c, littleEndian);
        o += 4;
      }
    }
    view.setInt32(o, tex, littleEndian);
    o += 4;
  }
  return bytes;
}

function sourceFromBytes(bytes) {
  return {
    size: bytes.length,
    read: async (start, end) => bytes.slice(start, end).buffer,
  };
}

test("groups faces by atlas, welds corners, quantizes on the scene grid", async () => {
  const chunks = [];
  const result = await parseScenePly(sourceFromBytes(buildPly()), {
    onChunk: (chunk) => chunks.push(chunk),
  });

  assert.deepEqual(result.textureNames, ["atlas_0.jpg", "atlas_1.jpg"]);
  assert.equal(result.vertexCount, 6);
  assert.equal(result.faceCount, 4);
  assert.equal(result.triangleCount, 4);
  assert.equal(result.skippedFaces, 0);
  assert.deepEqual(result.bbox, { min: [0, 0, 0], max: [2, 1, 1] });
  assert.deepEqual(result.atlases, [
    { atlasIndex: 0, triangleCount: 2, chunkCount: 1 },
    { atlasIndex: 1, triangleCount: 2, chunkCount: 1 },
  ]);

  assert.equal(chunks.length, 2);
  const [a, b] = chunks;
  // each quad: 6 corners welded into 4 vertices
  assert.equal(a.vertexCount, 4);
  assert.equal(b.vertexCount, 4);
  assert.deepEqual([...a.index], [0, 1, 2, 0, 2, 3]);
  // vertex 1 (x = 1 of 2) → mid grid; vertex 2 z = 0.5 of 1 → mid grid
  assert.deepEqual([...a.positions.slice(3, 6)], [32768, 0, 0]);
  assert.deepEqual([...a.positions.slice(6, 9)], [32768, 65535, 32768]);
  // v is flipped: file (1, 1) → (65535, 0)
  assert.ok(a.uvs instanceof Uint16Array);
  assert.deepEqual([...a.uvs.slice(4, 6)], [65535, 0]);
  assert.deepEqual(a.boundsMin, [0, 0, 0]);
  assert.deepEqual(b.boundsMax, [1, 1, 1]);
});

test("reads big-endian files and faces split across slices", async () => {
  const chunks = [];
  const result = await parseScenePly(
    sourceFromBytes(buildPly({ littleEndian: false })),
    { onChunk: (chunk) => chunks.push(chunk), sliceBytes: 50 }
  );
  assert.equal(result.triangleCount, 4);
  assert.deepEqual([...chunks[0].index], [0, 1, 2, 0, 2, 3]);
});

test("untextured mesh: a single chunk without uvs", async () => {
  const chunks = [];
  const bytes = buildPly({ withUvs: false });
  const result = await parseScenePly(sourceFromBytes(bytes), {
    onChunk: (chunk) => chunks.push(chunk),
  });
  assert.equal(result.hasUvs, false);
  assert.equal(chunks[0].uvs, null);
});

test("rejects ASCII and truncated files", async () => {
  const ascii = new TextEncoder().encode(
    "ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nend_header\n0\n"
  );
  await assert.rejects(parseScenePly(sourceFromBytes(ascii)), {
    code: "PLY_ASCII_UNSUPPORTED",
  });
  const bytes = buildPly();
  await assert.rejects(
    parseScenePly(sourceFromBytes(bytes.slice(0, bytes.length - 10))),
    { code: "PLY_TRUNCATED" }
  );
});

// --- replay on a real DJI Terra export (skipped when the file is absent):
// SCENE_PLY=/path/to/Block.ply node --test …

const realPath = process.env.SCENE_PLY;

test(
  "real scan replay",
  { skip: !realPath || !existsSync(realPath) },
  async () => {
    const fd = openSync(realPath, "r");
    const source = {
      size: statSync(realPath).size,
      read: async (start, end) => {
        const buffer = Buffer.alloc(end - start);
        const n = readSync(fd, buffer, 0, end - start, start);
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + n);
      },
    };
    let chunkCount = 0;
    let vertices = 0;
    let storedBytes = 0;
    let maxVertices = 0;
    const t0 = performance.now();
    const result = await parseScenePly(source, {
      onChunk: (chunk) => {
        chunkCount++;
        vertices += chunk.vertexCount;
        maxVertices = Math.max(maxVertices, chunk.vertexCount);
        storedBytes +=
          chunk.positions.byteLength +
          (chunk.uvs?.byteLength ?? 0) +
          chunk.index.byteLength;
        assert.equal(chunk.index.length, chunk.triangleCount * 3);
      },
    });
    const ms = Math.round(performance.now() - t0);
    console.log({
      ...result,
      atlases: result.atlases.length,
      chunkCount,
      weldedVertices: vertices,
      storedMB: Math.round(storedBytes / 1e6),
      ms,
    });
    assert.ok(maxVertices <= 65535);
    assert.equal(result.skippedFaces, 0);
    assert.equal(
      result.atlases.reduce((sum, a) => sum + a.triangleCount, 0),
      result.triangleCount
    );
  }
);
