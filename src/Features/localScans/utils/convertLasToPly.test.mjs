import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import convertLasToPly from "./convertLasToPly.js";
import { readLasHeader } from "./readLasHeader.js";
import readLazChunkTable from "./readLazChunkTable.js";
import { readLocalPly } from "./readLocalPly.js";

// Uncompressed LAS 1.2 (format 2) or 1.4 (format 7), georeferenced, 16-bit
// colours.
function synthLas({ minor = 2, count = 5 } = {}) {
  const format = minor >= 4 ? 7 : 2;
  const recordLength = format === 2 ? 26 : 36;
  const headerSize = minor >= 4 ? 375 : 227;
  const view = new DataView(new ArrayBuffer(headerSize + count * recordLength));
  [..."LASF"].forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
  view.setUint8(24, 1);
  view.setUint8(25, minor);
  view.setUint16(94, headerSize, true);
  view.setUint32(96, headerSize, true);
  view.setUint8(104, format);
  view.setUint16(105, recordLength, true);
  view.setUint32(107, minor >= 4 ? 0 : count, true);
  [0.001, 0.001, 0.001].forEach((v, i) =>
    view.setFloat64(131 + i * 8, v, true)
  );
  [650000, 6860000, 30].forEach((v, i) =>
    view.setFloat64(155 + i * 8, v, true)
  );
  // maxX, minX, maxY, minY, maxZ, minZ
  [650004.5, 650000.5, 6860008, 6860000, 34.25, 30.25].forEach((v, i) =>
    view.setFloat64(179 + i * 8, v, true)
  );
  if (minor >= 4) view.setBigUint64(247, BigInt(count), true);
  for (let i = 0; i < count; i++) {
    const record = headerSize + i * recordLength;
    view.setInt32(record, 500 + i * 1000, true);
    view.setInt32(record + 4, i * 2000, true);
    view.setInt32(record + 8, 250 + i * 1000, true);
    const color = record + (format === 2 ? 20 : 30);
    view.setUint16(color, 65535, true);
    view.setUint16(color + 2, 32768, true);
    view.setUint16(color + 4, i * 256, true);
  }
  return new File([view.buffer], "cloud.las");
}

for (const minor of [2, 4])
  test(`converts an uncompressed LAS 1.${minor}, recentred`, async () => {
    const { file, importedFrom } = await convertLasToPly(synthLas({ minor }));
    assert.equal(file.name, "cloud.ply");
    assert.deepEqual(importedFrom, {
      format: "LAS",
      fileName: "cloud.las",
      lasVersion: `1.${minor}`,
      pointFormat: minor >= 4 ? 7 : 2,
      sourceCount: 5,
      skip: 1,
      origin: [650003, 6860004, 30],
    });
    const result = await readLocalPly(file);
    assert.equal(result.count, 5);
    assert.deepEqual(
      [...result.positions.slice(0, 6)],
      [-2.5, -4, 0.25, -1.5, -2, 1.25]
    );
    assert.deepEqual(
      [...result.colors.slice(0, 6)],
      [255, 128, 0, 255, 128, 1]
    );
  });

// Real compressed file: set LAZ_FIXTURE to a chunked .laz (LAS ≤ 1.4, point
// format 0-3 or 6-8). The chunk-by-chunk decode is compared with the
// whole-file sequential decoder of laz-perf.
const fixture = process.env.LAZ_FIXTURE;
test(
  "decodes a LAZ chunk by chunk like the whole-file decoder",
  { skip: !fixture || !fs.existsSync(fixture) },
  async () => {
    const { createLazPerf } = (await import("laz-perf")).default;
    const raw = fs.readFileSync(fixture);
    const file = new File([raw], "fixture.laz");
    const header = await readLasHeader(file);
    const chunks = await readLazChunkTable(file, header);
    assert.equal(
      chunks.reduce((n, chunk) => n + chunk.pointCount, 0),
      header.pointCount
    );

    const { file: ply, importedFrom } = await convertLasToPly(file, {
      createLazPerf: () => createLazPerf(),
    });
    const result = await readLocalPly(ply);
    assert.equal(
      result.count,
      Math.ceil(header.pointCount / importedFrom.skip)
    );

    const lazPerf = await createLazPerf();
    const filePtr = lazPerf._malloc(raw.length);
    lazPerf.HEAPU8.set(raw, filePtr);
    const laszip = new lazPerf.LASZip();
    laszip.open(filePtr, raw.length);
    const recordPtr = lazPerf._malloc(header.recordLength);
    let kept = 0;
    for (let i = 0; i < header.pointCount; i++) {
      laszip.getPoint(recordPtr);
      if (i % importedFrom.skip) continue;
      const view = new DataView(lazPerf.HEAPU8.buffer, recordPtr, 12);
      for (let axis = 0; axis < 3; axis++) {
        const expected = Math.fround(
          view.getInt32(axis * 4, true) * header.scale[axis] +
            header.offset[axis] -
            importedFrom.origin[axis]
        );
        if (expected !== result.positions[kept * 3 + axis])
          assert.fail(`point ${i}, axis ${axis}`);
      }
      kept++;
    }
    laszip.delete();
  }
);
