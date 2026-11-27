import assert from "node:assert/strict";
import test from "node:test";
import createPointsPlyWriter from "./createPointsPlyWriter.js";
import { readLocalPly } from "./readLocalPly.js";

test("writes a PLY the scan decoder reads back", async () => {
  const writer = createPointsPlyWriter({
    name: "cloud.ply",
    comments: ["converted from LAS 1.2"],
  });
  writer.push(1.5, 2, 3, 255, 0, 10);
  writer.push(-1, 4.25, 0, 1, 2, 3);
  assert.equal(writer.count, 2);
  const file = writer.finish({ origin: [650050, 6860026, 31] });
  assert.equal(file.name, "cloud.ply");
  const result = await readLocalPly(file);
  assert.equal(result.kind, "POINTS");
  assert.equal(result.count, 2);
  assert.deepEqual([...result.positions], [1.5, 2, 3, -1, 4.25, 0]);
  assert.deepEqual([...result.colors], [255, 0, 10, 1, 2, 3]);
  const text = await file.slice(0, 200).text();
  assert.match(text, /\ncomment source_origin 650050 6860026 31\n/);
});

test("writes several blocks", async () => {
  const count = 65536 * 2 + 10;
  const writer = createPointsPlyWriter();
  for (let i = 0; i < count; i++) writer.push(i, 0, 0, 0, 0, 0);
  const result = await readLocalPly(writer.finish());
  assert.equal(result.count, count);
  assert.equal(result.positions[(count - 1) * 3], count - 1);
});

test("rejects an empty cloud and invalid coordinates", () => {
  assert.throws(() => createPointsPlyWriter().finish());
  assert.throws(() => createPointsPlyWriter().push(NaN, 0, 0, 0, 0, 0));
});
