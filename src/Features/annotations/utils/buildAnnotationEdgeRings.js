import { expandRingWithOffsets } from "Features/geometry/utils/arcSampling";

// Converts one resolved (pixel-space) annotation into flat polygonal "rings"
// ready for edge matching (see findSharedEdgeChains): the POLYGON main ring +
// one ring per cut, or the POLYLINE/STRIP path. Arcs are expanded into
// straight samples carrying lerped offsetTop (same handling as
// buildWallPolylineFromChain) — sampled arc points have no id, which is fine:
// the geometric adjacency criterion covers them.
//
// Returns [{ kind: "MAIN"|"CUT"|"LINE", closed, points: [{id?, x, y,
// offsetTop, ...}] }] (closed rings carry no closing duplicate).

// 2 segments per sample-half → 4 samples ≈ 8 straight segments per arc.
const ARC_SAMPLES = 4;

function dedupeRing(points, closed) {
  const ring = [];
  for (const p of points ?? []) {
    if (p?.x == null || p?.y == null) continue;
    const last = ring[ring.length - 1];
    if (last && p.id && last.id === p.id) continue;
    ring.push(p);
  }
  if (
    closed &&
    ring.length > 1 &&
    ring[0].id &&
    ring[0].id === ring[ring.length - 1].id
  )
    ring.pop();
  return ring;
}

function buildRing({ kind, points, closed, arcSamples }) {
  const ring = dedupeRing(points, closed);
  if (ring.length < 2) return null;
  const expanded = expandRingWithOffsets(ring, arcSamples, closed).filter(
    (p) => typeof p?.x === "number" && typeof p?.y === "number"
  );
  if (expanded.length < 2) return null;
  return { kind, closed, points: expanded };
}

export default function buildAnnotationEdgeRings(
  annotation,
  { arcSamples = ARC_SAMPLES } = {}
) {
  if (!annotation) return [];

  const rings = [];

  if (annotation.type === "POLYGON") {
    rings.push(
      buildRing({
        kind: "MAIN",
        points: annotation.points,
        closed: true,
        arcSamples,
      })
    );
    for (const cut of annotation.cuts ?? []) {
      rings.push(
        buildRing({
          kind: "CUT",
          points: cut?.points,
          closed: true,
          arcSamples,
        })
      );
    }
  } else {
    rings.push(
      buildRing({
        kind: "LINE",
        points: annotation.points,
        closed: !!annotation.closeLine,
        arcSamples,
      })
    );
  }

  return rings.filter(Boolean);
}
