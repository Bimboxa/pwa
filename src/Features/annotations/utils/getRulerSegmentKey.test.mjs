import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getRulerSegmentKeys,
  hasActiveRulerLabelOffsets,
  remapRulerLabelOffsets,
} from "./getRulerSegmentKey.js";

const pts = (...ids) => ids.map((id) => ({ id }));

test("a plain chain is keyed by its end point ids", () => {
  assert.deepEqual(getRulerSegmentKeys(pts("A", "B", "C")), ["A|B", "B|C"]);
});

test("a riser (same id twice) needs no counter", () => {
  assert.deepEqual(getRulerSegmentKeys(pts("A", "A", "Q")), ["A|A", "A|Q"]);
});

test("a repeated ordered pair gets an occurrence suffix", () => {
  assert.deepEqual(getRulerSegmentKeys(pts("A", "B", "A", "B")), [
    "A|B",
    "B|A",
    "A|B#1",
  ]);
});

test("hasActiveRulerLabelOffsets ignores orphan keys and zero vectors", () => {
  const points = pts("A", "B", "C");
  assert.equal(hasActiveRulerLabelOffsets({ points }), false);
  assert.equal(
    hasActiveRulerLabelOffsets({
      points,
      rulerLabelOffsets: { "X|Y": { x: 1, y: 0, z: 0 } },
    }),
    false
  );
  assert.equal(
    hasActiveRulerLabelOffsets({
      points,
      rulerLabelOffsets: { "A|B": { x: 0, y: 0.0001, z: 0 } },
    }),
    false
  );
  assert.equal(
    hasActiveRulerLabelOffsets({
      points,
      rulerLabelOffsets: { "B|C": { x: 0, y: 0.5, z: 0 } },
    }),
    true
  );
});

test("remapRulerLabelOffsets follows re-minted point ids index for index", () => {
  const out = remapRulerLabelOffsets(
    { "A|B": { x: 0.2, y: 0, z: 0 }, "X|Y": { x: 9, y: 9, z: 9 } },
    pts("A", "B", "C"),
    pts("N1", "N2", "N3")
  );
  assert.deepEqual(out, { "N1|N2": { x: 0.2, y: 0, z: 0 } });
  assert.equal(
    remapRulerLabelOffsets(
      { "A|B": { x: 1, y: 0, z: 0 } },
      pts("A", "B"),
      pts("N1")
    ),
    null
  );
  assert.equal(
    remapRulerLabelOffsets(null, pts("A", "B"), pts("N1", "N2")),
    null
  );
});
