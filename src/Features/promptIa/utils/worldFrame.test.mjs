import assert from "node:assert/strict";
import { test } from "node:test";

import computeBaseMapPlacementFromPointPairs from "../../promptIaProject/utils/computeBaseMapPlacementFromPointPairs.js";
import {
  getWorldAspectGap,
  getWorldMeterByPx,
  getWorldPlacementPairs,
  imageToWorld,
  parseWorldFrame,
  worldToImage,
} from "./worldFrame.js";

const close = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// north-up render of a 50 m × 80 m rectangle in Lambert-like coordinates
const NORTH_UP = {
  unit: "m",
  corners: {
    topLeft: { x: 1040920, y: 6295300 },
    topRight: { x: 1040970, y: 6295300 },
    bottomLeft: { x: 1040920, y: 6295220 },
  },
};

test("parseWorldFrame derives the size and the angle", () => {
  const r = parseWorldFrame(NORTH_UP);
  assert.equal(r.ok, true);
  close(r.frame.widthMeters, 50);
  close(r.frame.heightMeters, 80);
  close(r.frame.angleDeg, 0);
  assert.equal(r.frame.altitude, 0);
});

test("parseWorldFrame converts millimetres and the altitude", () => {
  const r = parseWorldFrame({
    unit: "mm",
    altitude: 13500,
    corners: {
      topLeft: { x: 0, y: 8000 },
      topRight: { x: 5000, y: 8000 },
      bottomLeft: { x: 0, y: 0 },
    },
  });
  close(r.frame.widthMeters, 5);
  close(r.frame.heightMeters, 8);
  close(r.frame.altitude, 13.5);
});

test("parseWorldFrame rejects mirrored, sheared and degenerate frames", () => {
  const { corners } = NORTH_UP;
  // y up in the image = bottomLeft above topLeft
  assert.match(
    parseWorldFrame({
      corners: { ...corners, bottomLeft: { x: 1040920, y: 6295380 } },
    }).error,
    /miroir/
  );
  assert.match(
    parseWorldFrame({
      corners: { ...corners, bottomLeft: { x: 1040950, y: 6295220 } },
    }).error,
    /rectangle/
  );
  assert.match(
    parseWorldFrame({ corners: { ...corners, topRight: corners.topLeft } })
      .error,
    /nulle/
  );
  assert.match(parseWorldFrame({ unit: "km", corners }).error, /unit/);
  assert.match(parseWorldFrame({ corners: {} }).error, /topLeft/);
  assert.equal(parseWorldFrame(null).ok, false);
});

test("worldToImage / imageToWorld are inverse, y flipped", () => {
  const { frame } = parseWorldFrame(NORTH_UP);
  const p = worldToImage(frame, { x: 1040945, y: 6295280 });
  close(p.x, 0.5);
  close(p.y, 0.25);
  const back = imageToWorld(frame, p);
  close(back.x, 1040945);
  close(back.y, 6295280);
});

test("a frame rotated with the building keeps the conversion exact", () => {
  // image x axis = building axis, 70° from the source x axis
  const a = (70 * Math.PI) / 180;
  const ex = { x: Math.cos(a), y: Math.sin(a) };
  const down = { x: Math.sin(a), y: -Math.cos(a) }; // ex rotated by -90°
  const o = { x: 1000, y: 2000 };
  const { frame, ok } = parseWorldFrame({
    corners: {
      topLeft: o,
      topRight: { x: o.x + 40 * ex.x, y: o.y + 40 * ex.y },
      bottomLeft: { x: o.x + 20 * down.x, y: o.y + 20 * down.y },
    },
  });
  assert.equal(ok, true);
  close(frame.angleDeg, 70);
  close(frame.widthMeters, 40);
  close(frame.heightMeters, 20);
  const p = worldToImage(frame, {
    x: o.x + 10 * ex.x + 5 * down.x,
    y: o.y + 10 * ex.y + 5 * down.y,
  });
  close(p.x, 0.25);
  close(p.y, 0.25);
});

test("scale and aspect come from the frame and the picture", () => {
  const { frame } = parseWorldFrame(NORTH_UP);
  close(getWorldMeterByPx(frame, { width: 2500, height: 4000 }), 0.02);
  close(getWorldAspectGap(frame, { width: 2500, height: 4000 }), 0);
  assert.ok(getWorldAspectGap(frame, { width: 2500, height: 3000 }) > 0.2);
});

test("two base maps of the same world superpose in the scene", () => {
  const reference = parseWorldFrame(NORTH_UP).frame;
  const referenceSize = { width: 2500, height: 4000 }; // 0.02 m/px
  // a smaller frame, 10 m east and 20 m south of the reference top-left
  const frame = parseWorldFrame({
    corners: {
      topLeft: { x: 1040930, y: 6295280 },
      topRight: { x: 1040950, y: 6295280 },
      bottomLeft: { x: 1040930, y: 6295270 },
    },
  }).frame;
  const size = { width: 2000, height: 1000 }; // 0.01 m/px
  const placement = computeBaseMapPlacementFromPointPairs({
    pairs: getWorldPlacementPairs({
      frame,
      size,
      referenceFrame: reference,
      referenceSize,
    }),
    planSize: size,
    planMeterByPx: getWorldMeterByPx(frame, size),
    referenceSize,
    referenceMeterByPx: getWorldMeterByPx(reference, referenceSize),
    altitude: 3,
  });
  close(placement.angleDeg, 0);
  close(placement.scaleRatio, 1);
  close(placement.rmsMeters, 0);
  // centres: reference (1040945, 6295260), plan (1040940, 6295275)
  // → 5 m west (−x), 15 m north (image up = −z)
  close(placement.position.x, -5);
  close(placement.position.z, -15);
  assert.equal(placement.position.y, 3);
});
