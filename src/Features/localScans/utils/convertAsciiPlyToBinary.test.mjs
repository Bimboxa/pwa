import assert from "node:assert/strict";
import test from "node:test";
import convertAsciiPlyToBinary, {
  isAsciiPly,
} from "./convertAsciiPlyToBinary.js";
import { readLocalPly } from "./readLocalPly.js";

const HEADER = [
  "ply",
  "format ascii 1.0",
  "comment exported by a scanner",
  "element vertex 3",
  "property double x",
  "property float y",
  "property float z",
  "property uchar red",
  "property uchar green",
  "property uchar blue",
  "end_header",
];
const ROWS = ["1.5 2 3 255 0 10", "-1 4.25 0 1 2 3", "1e-1 -2.5E0 7 9 8 7"];
const POSITIONS = [1.5, 2, 3, -1, 4.25, 0, 0.1, -2.5, 7];
const COLORS = [255, 0, 10, 1, 2, 3, 9, 8, 7];

const ascii = (rows = ROWS, { header = HEADER, eol = "\n", tail = eol } = {}) =>
  new File([[...header, ...rows].join(eol) + tail], "cloud.ply");

async function assertCloud(file, options) {
  const binary = await convertAsciiPlyToBinary(file, undefined, options);
  assert.equal(binary.name, "cloud.ply");
  assert.equal(await isAsciiPly(binary), false);
  const result = await readLocalPly(binary);
  assert.equal(result.kind, "POINTS");
  assert.equal(result.count, 3);
  assert.deepEqual([...result.positions], [...new Float32Array(POSITIONS)]);
  assert.deepEqual([...result.colors], COLORS);
}

test("converts an ASCII cloud to a binary PLY the decoder reads", async () => {
  const file = ascii();
  assert.equal(await isAsciiPly(file), true);
  await assertCloud(file);
});

test("keeps the declared types and the comments", async () => {
  const binary = await convertAsciiPlyToBinary(ascii());
  const text = await binary.slice(0, 256).text();
  assert.match(text, /^ply\nformat binary_little_endian 1\.0\n/);
  assert.match(text, /comment exported by a scanner\n/);
  assert.match(text, /property double x\n/);
  const headerLength = text.indexOf("end_header\n") + 11;
  assert.equal(binary.size, headerLength + 3 * (8 + 4 + 4 + 3));
});

test("accepts CRLF, repeated blanks and a missing final newline", async () => {
  await assertCloud(ascii(ROWS, { eol: "\r\n" }));
  await assertCloud(
    ascii(ROWS.map((row) => `  ${row.replaceAll(" ", " \t ")}  `))
  );
  await assertCloud(ascii(ROWS, { tail: "" }));
});

test("carries values cut by a slice boundary", async () => {
  for (const sliceBytes of [1, 2, 3, 5, 7, 16])
    await assertCloud(ascii(), { sliceBytes });
});

test("reports progress up to the end of the file", async () => {
  const ratios = [];
  await convertAsciiPlyToBinary(ascii(), (ratio) => ratios.push(ratio), {
    sliceBytes: 16,
  });
  assert.ok(ratios.length > 1);
  assert.equal(ratios.at(-1), 1);
});

test("rejects truncated, overlong and non-numeric bodies", async () => {
  await assert.rejects(
    convertAsciiPlyToBinary(ascii(ROWS.slice(0, 2))),
    /Taille/
  );
  await assert.rejects(
    convertAsciiPlyToBinary(ascii([...ROWS.slice(0, 2), "1 2 3 4 5"])),
    /Taille/
  );
  await assert.rejects(
    convertAsciiPlyToBinary(ascii([...ROWS, "1 2 3 4 5 6"])),
    /Taille/
  );
  await assert.rejects(
    convertAsciiPlyToBinary(ascii(["1 2 abc 0 0 0", ...ROWS.slice(1)])),
    /abc/
  );
});

test("rejects meshes, list properties and binary sources", async () => {
  const withFace = [...HEADER];
  withFace.splice(
    -1,
    0,
    "element face 1",
    "property list uchar int vertex_indices"
  );
  await assert.rejects(
    convertAsciiPlyToBinary(ascii([...ROWS, "3 0 1 2"], { header: withFace })),
    /maillage/
  );
  const withList = [...HEADER];
  withList.splice(-1, 0, "property list uchar int extra");
  await assert.rejects(
    convertAsciiPlyToBinary(ascii(ROWS, { header: withList })),
    /propriétés/
  );
  const binaryHeader = HEADER.map((line) =>
    line.startsWith("format") ? "format binary_little_endian 1.0" : line
  );
  await assert.rejects(
    convertAsciiPlyToBinary(ascii(ROWS, { header: binaryHeader })),
    /ASCII/
  );
});

test("passes non-finite floats through for the decoder to judge", async () => {
  const binary = await convertAsciiPlyToBinary(
    ascii(["nan 2 3 0 0 0", ...ROWS.slice(1)])
  );
  await assert.rejects(readLocalPly(binary), /Coordonnées/);
});
