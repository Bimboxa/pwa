import assert from "node:assert/strict";
import test from "node:test";
import { readLocalPly, readLocalPlyHeader } from "./readLocalPly.js";

function fixture({
  splat = false,
  bigEndian = false,
  positions = [
    [1, 2, 3],
    [-1, 4, 0],
  ],
} = {}) {
  const keys = splat
    ? "x y z nx ny nz f_dc_0 f_dc_1 f_dc_2 opacity scale_0 scale_1 scale_2 rot_0 rot_1 rot_2 rot_3".split(
        " "
      )
    : ["x", "y", "z"];
  const header = `ply\nformat binary_${bigEndian ? "big" : "little"}_endian 1.0\nelement vertex ${positions.length}\n${keys.map((key) => `property float ${key}`).join("\n")}\nend_header\n`;
  const buffer = new ArrayBuffer(positions.length * keys.length * 4);
  const view = new DataView(buffer);
  positions.forEach((point, i) =>
    point.forEach((v, j) =>
      view.setFloat32((i * keys.length + j) * 4, v, !bigEndian)
    )
  );
  return new Blob([header, buffer]);
}

test("recognizes the PortalCam property layout and decodes DC colors", async () => {
  const result = await readLocalPly(fixture({ splat: true }));
  assert.equal(result.kind, "SPLAT");
  assert.equal(result.count, 2);
  assert.deepEqual([...result.positions], [1, 2, 3, -1, 4, 0]);
  assert.deepEqual([...result.colors], [128, 128, 128, 128, 128, 128]);
  assert.deepEqual(result.bounds, { min: [-1, 2, 0], max: [1, 4, 3] });
});

test("decodes ordinary binary points in either byte order", async () => {
  for (const bigEndian of [true, false]) {
    const result = await readLocalPly(fixture({ bigEndian }));
    assert.equal(result.kind, "POINTS");
    assert.deepEqual([...result.positions], [1, 2, 3, -1, 4, 0]);
  }
});

test("rejects truncated files before allocating coordinate buffers", async () => {
  const file = fixture();
  await assert.rejects(
    readLocalPlyHeader(file.slice(0, file.size - 1)),
    /Taille/
  );
});

test("redirects mesh imports to the existing workflow", async () => {
  await assert.rejects(
    readLocalPlyHeader(
      new Blob([
        "ply\nformat binary_little_endian 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nend_header\n",
      ])
    ),
    /maillage/
  );
});

test("rejects ASCII, missing coordinates, excessive counts and nonfinite data", async () => {
  await assert.rejects(
    readLocalPlyHeader(new Blob(["ply\nformat ascii 1.0\nend_header\n"])),
    /ASCII/
  );
  await assert.rejects(
    readLocalPlyHeader(
      new Blob([
        "ply\nformat binary_little_endian 1.0\nelement vertex 40000001\nend_header\n",
      ])
    ),
    /40 millions/
  );
  await assert.rejects(
    readLocalPlyHeader(
      new Blob([
        "ply\nformat binary_little_endian 1.0\nelement vertex 2\nend_header\n",
      ])
    ),
    /coordonnées/
  );
  await assert.rejects(
    readLocalPly(fixture({ positions: [[NaN, 1, 2]] })),
    /Coordonnées/
  );
});

test("reads in bounded slices and reports monotonic progress", async () => {
  const file = fixture({
    positions: Array.from({ length: 70000 }, (_, i) => [i, 0, 1]),
  });
  const reads = [];
  const progress = [];
  const source = {
    size: file.size,
    slice(start, end) {
      reads.push(end - start);
      return file.slice(start, end);
    },
  };
  const result = await readLocalPly(source, (ratio) => progress.push(ratio));
  assert.equal(result.count, 70000);
  assert.ok(Math.max(...reads) <= 65536 * 12);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress[0] < progress[1]);
});

test("reads RGB attributes with mixed scalar widths", async () => {
  const bytes = new ArrayBuffer(15);
  const view = new DataView(bytes);
  view.setFloat32(0, 2, true);
  view.setFloat32(4, 3, true);
  view.setFloat32(8, 4, true);
  new Uint8Array(bytes).set([255, 10, 20], 12);
  const file = new Blob([
    "ply\nformat binary_little_endian 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n",
    bytes,
  ]);
  assert.deepEqual([...(await readLocalPly(file)).colors], [255, 10, 20]);
});

// Header-only virtual files exercise large limits without allocating gigabytes.
function virtualCloud(count, { splat = false } = {}) {
  const keys = splat
    ? "x y z f_dc_0 f_dc_1 f_dc_2 opacity scale_0 scale_1 scale_2 rot_0 rot_1 rot_2 rot_3".split(
        " "
      )
    : ["x", "y", "z"];
  const header = new Blob([
    `ply\nformat binary_little_endian 1.0\nelement vertex ${count}\n${keys.map((key) => `property float ${key}`).join("\n")}\nend_header\n`,
  ]);
  return {
    size: header.size + count * keys.length * 4,
    slice: (...args) => header.slice(...args),
  };
}

test("accepts full-resolution large point clouds up to forty million vertices", async () => {
  for (const count of [32_752_655, 40_000_000]) {
    const header = await readLocalPlyHeader(virtualCloud(count));
    assert.equal(header.count, count);
    assert.equal(header.kind, "POINTS");
  }
});

test("large-file support does not raise the Gaussian allocation budget", async () => {
  await assert.rejects(
    readLocalPlyHeader(virtualCloud(5_000_001, { splat: true })),
    /5 millions de gaussiennes/
  );
  assert.equal(
    (await readLocalPlyHeader(virtualCloud(5_000_000, { splat: true }))).kind,
    "SPLAT"
  );
});

test("rejects sources above two GiB before reading any bytes", async () => {
  await assert.rejects(
    readLocalPlyHeader({
      size: 2 * 1024 ** 3 + 1,
      slice() {
        assert.fail("An oversized source must not be read");
      },
    }),
    /2 Gio/
  );
});
