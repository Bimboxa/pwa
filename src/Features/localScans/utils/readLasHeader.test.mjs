import assert from "node:assert/strict";
import test from "node:test";
import {
  getLazConversionPlan,
  getLazOrigin,
  MAX_LAZ_BYTES,
  MAX_LAZ_POINTS,
  readLasHeader,
} from "./readLasHeader.js";

function lasHeader({
  minor = 2,
  format = 3,
  compressed = true,
  legacyCount = 1000,
  count64 = 0,
  signature = "LASF",
} = {}) {
  const size = minor >= 4 ? 375 : 227;
  const view = new DataView(new ArrayBuffer(size));
  [...signature].forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
  view.setUint8(24, 1);
  view.setUint8(25, minor);
  view.setUint16(94, size, true);
  view.setUint32(96, size, true);
  view.setUint8(104, format | (compressed ? 0x80 : 0));
  view.setUint16(105, 34, true);
  view.setUint32(107, legacyCount, true);
  [0.001, 0.001, 0.01].forEach((v, i) => view.setFloat64(131 + i * 8, v, true));
  [650000, 6860000, 0].forEach((v, i) => view.setFloat64(155 + i * 8, v, true));
  // maxX, minX, maxY, minY, maxZ, minZ
  [650100, 650000, 6860050, 6860000, 42.5, 31.2].forEach((v, i) =>
    view.setFloat64(179 + i * 8, v, true)
  );
  if (minor >= 4) view.setBigUint64(247, BigInt(count64), true);
  return new File([view.buffer], "cloud.laz");
}

test("reads a LAS 1.2 header", async () => {
  const header = await readLasHeader(lasHeader());
  assert.equal(header.version, "1.2");
  assert.equal(header.pointFormat, 3);
  assert.equal(header.isCompressed, true);
  assert.equal(header.pointCount, 1000);
  assert.deepEqual(header.scale, [0.001, 0.001, 0.01]);
  assert.deepEqual(header.offset, [650000, 6860000, 0]);
  assert.deepEqual(header.min, [650000, 6860000, 31.2]);
  assert.deepEqual(header.max, [650100, 6860050, 42.5]);
  assert.equal(header.headerSize, 227);
  assert.equal(header.pointDataOffset, 227);
  assert.equal(header.recordLength, 34);
});

test("reads the 64-bit point count of LAS 1.4", async () => {
  const header = await readLasHeader(
    lasHeader({ minor: 4, format: 6, legacyCount: 0, count64: 5_000_000_000 })
  );
  assert.equal(header.version, "1.4");
  assert.equal(header.pointFormat, 6);
  assert.equal(header.pointCount, 5_000_000_000);
});

test("flags an uncompressed LAS", async () => {
  const header = await readLasHeader(lasHeader({ compressed: false }));
  assert.equal(header.isCompressed, false);
});

test("rejects a file that is not LAS, or empty", async () => {
  await assert.rejects(readLasHeader(lasHeader({ signature: "ply\n" })), {
    code: "LAS_INVALID",
  });
  await assert.rejects(readLasHeader(new File(["LASF"], "short.laz")), {
    code: "LAS_INVALID",
  });
  await assert.rejects(readLasHeader(lasHeader({ legacyCount: 0 })), {
    code: "LAS_EMPTY",
  });
});

test("plans the decimation step and rejects what cannot be read", async () => {
  const v12 = await readLasHeader(lasHeader());
  assert.deepEqual(getLazConversionPlan(v12, 1024), {
    skip: 1,
    decodedCount: 1000,
  });
  const large = await readLasHeader(
    lasHeader({
      minor: 4,
      format: 7,
      legacyCount: 0,
      count64: MAX_LAZ_POINTS * 2 + 1,
    })
  );
  const plan = getLazConversionPlan(large, 1024);
  assert.equal(plan.skip, 3);
  assert.ok(plan.decodedCount <= MAX_LAZ_POINTS);
  // a file of 3.5 GiB is accepted, not one above the cap
  assert.equal(getLazConversionPlan(v12, 3.5 * 1024 ** 3).skip, 1);
  assert.throws(() => getLazConversionPlan(v12, MAX_LAZ_BYTES + 1), {
    code: "LAS_TOO_LARGE",
  });
  // waveform point formats: only uncompressed
  const waveform = { minor: 3, format: 5 };
  assert.throws(
    () =>
      getLazConversionPlan(
        { ...v12, pointFormat: 5, isCompressed: true },
        1024
      ),
    { code: "LAS_POINT_FORMAT" }
  );
  const las = await readLasHeader(
    lasHeader({ ...waveform, compressed: false })
  );
  assert.equal(getLazConversionPlan(las, 1024).skip, 1);
});

test("recentres only a cloud far from the origin", () => {
  assert.deepEqual(getLazOrigin([-12, -3, 0], [40, 25, 9]), [0, 0, 0]);
  assert.deepEqual(
    getLazOrigin([650000, 6860000, 31.2], [650100, 6860051, 42.5]),
    [650050, 6860026, 31]
  );
});
