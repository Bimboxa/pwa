import {
  getArcFrame,
  isExactArcTriplet,
} from "Features/geometry/utils/arcChordSagitta";

import getCoteDisplayValue from "./getCoteDisplayValue";

// Chord + sagitta (« corde » / « flèche ») items of every exact S-C-S arc of a
// POLYLINE / POLYGON / STRIP contour — the arc counterpart of
// getSegmentLengthItems (whose straight items skip the two arc halves).
//
// `points` are the RESOLVED pixel points, in order, no duplicated closing
// point; `closed` lets a triplet wrap around the chain end. `index` is the
// index of P0, i.e. the index of the first stored half-segment (P0 → P1); the
// second half is (index + 1) % n.
export default function getArcDimensionItems({
  points,
  closed = false,
  meterByPx,
  unit = "M",
  decimals = 2,
  showUnitLabel = true,
}) {
  const pts = (points || []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  const n = pts.length;
  if (n < 3) return [];

  const at = (k) => pts[((k % n) + n) % n];
  const items = [];
  const lastStart = closed ? n - 1 : n - 3;

  for (let i = 0; i <= lastStart; i++) {
    const P0 = at(i);
    const P1 = at(i + 1);
    const P2 = at(i + 2);
    if (!isExactArcTriplet(P0, P1, P2)) continue;
    const frame = getArcFrame(P0, P1, P2);
    if (!frame) continue;

    const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
    const fmt = { meterByPx, unit, decimals, showUnitLabel };

    items.push({
      index: i,
      startPointId: P0.id,
      controlPointId: P1.id,
      endPointId: P2.id,
      P0,
      P1,
      P2,
      chordMid: frame.chordMid,
      arcMid: frame.arcMid,
      normal: frame.normal,
      chordDir: frame.chordDir,
      chordPx: frame.chordPx,
      sagittaPx: frame.sagittaPx,
      chordMeters: hasScale ? frame.chordPx * meterByPx : null,
      sagittaMeters: hasScale ? frame.sagittaPx * meterByPx : null,
      chordText: getCoteDisplayValue({ p1: P0, p2: P2, ...fmt }),
      sagittaText: getCoteDisplayValue({
        p1: frame.chordMid,
        p2: frame.arcMid,
        ...fmt,
      }),
    });
  }

  return items;
}
