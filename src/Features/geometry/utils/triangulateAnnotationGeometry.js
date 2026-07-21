import { Vector2, ShapeUtils } from "three";

import partitionPolygonByIsoLines from "./partitionPolygonByIsoLines";
import partitionPolygonByChords from "./partitionPolygonByChords";
import computeDomeSteinerField, {
  computeDomeGridSpacing,
} from "./computeDomeSteinerField";
import prepareShellProfiles from "./prepareShellProfiles";
import delaunayTriangulate from "./delaunayTriangulate";
import expandShellProfileArcs from "./expandShellProfileArcs";

// Number of iso-height bands used for guideLine ramps. Single-sourced so the
// 3D mesh, the visible iso lines and the developed-surface quantity all agree.
export const ISO_BAND_LEVELS = 12;

// Triangulate a 2D contour (+ optional holes) into a non-planar 3D mesh,
// applying per-point Z lifts. Used both for 3D rendering (extrudeClosedShape's
// per-vertex-Z path) and for quantity computation (getAnnotationQties), so the
// two stay in sync when points carry offsetBottom / offsetTop.
//
// Z math, per point:
//   bottom = verticalLift + (p.offsetBottom ?? 0)
//   top    = verticalLift + height + (p.offsetBottom ?? 0) + (p.offsetTop ?? 0)
//
// Inputs are 2D in caller-consistent units (pixels for quantity callers, local
// world units for 3D callers). `unitScale` (= meters per input-unit, e.g.
// `meterByPx` for pixel callers) lets the result expose areas in m² without
// the caller having to do the conversion.
//
// Output shape:
//   { positions, indices, topRange, bottomRange, sideRange,
//     areaPlanar, areaTop, areaBottom, areaSides, volume }
//
// All `area*` and `volume` values are scaled by `unitScale` (^2 for areas,
// ^3 for volume). `positions` and `indices` are mesh-ready and are NOT scaled
// (they remain in input units, since the 3D consumer applies the basemap
// transform separately).
export default function triangulateAnnotationGeometry({
  contour,
  holes = [],
  innerPoints = [],
  height = 0,
  verticalLift = 0,
  unitScale = 1,
  zFightOffset = 0,
  // When > 0 (guideLine ramps), re-mesh the TOP as iso-height bands so the
  // transverse iso segments are real shared edges of the mesh faces. Falls
  // back to the earcut triangulation when banding cannot apply (holes,
  // Steiner points, flat, or non-monotone rails).
  isoBandLevels = 0,
  // Explicit iso chords ({ isoChords: [{polyline, height}] }, isoHeightLines):
  // exact planar-strip partition of the top face along the chords. Mutually
  // exclusive with isoBandLevels (iso lines take precedence over ramps). On
  // failure the per-vertex-z earcut path runs with the interpolated heights
  // baked at resolve time — same field, seam exactness lost.
  isoPartition = null,
  // Shell (profileLines): { mode: "DOME"|"TENT",
  //   profiles: [{ polyline: [{x, y, height}, ...] }] } — heights in meters
  // (offsetTop semantics), endpoints already contour-continuous. When
  // isoPartition chords are ALSO present they join the shell as
  // constant-height constraint lines (profiles and iso lines coexist on one
  // surface); crossings between all lines are resolved here
  // (prepareShellProfiles). Exclusive with isoBandLevels only.
  //   DOME (default): harmonic Steiner field + Delaunay top mesh; falls back
  //     to TENT when the solver can't apply or cuts exist.
  //   TENT: exact planar-strip chord partition (crossings pre-split);
  //     falls back to the plain per-vertex-z earcut on failure.
  shell = null,
}) {
  if (!Array.isArray(contour) || contour.length < 3) {
    return emptyResult();
  }

  let validHoles = (holes || []).filter(
    (h) => Array.isArray(h) && h.length >= 3
  );
  const validInnerEarly = (innerPoints || []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );

  // --- ISO-CHORD PARTITION (isoHeightLines): split the polygon into regions
  // along the drawn contour lines; every chord becomes a real shared mesh
  // edge, so the top face folds exactly on the iso lines. Walls / bottom /
  // quantities run on the SAME augmented rings.
  let bandedTris = null;
  let isoSegments = null;
  let extraPts = [];
  let isoPartitionApplied = false;
  let shellApplied = null; // "DOME" | "TENT" | null
  let shellProfileSegments = null;

  // --- SHELL (profileLines): absorbs the iso chords (constant-height
  // constraint lines) so profiles and iso lines constrain ONE surface.
  if (shell?.profiles?.length) {
    isoBandLevels = 0;

    // Constraint set = profiles (per-vertex heights, contour-inheriting
    // endpoints, vertical S-C-S arcs expanded into samples) + iso chords
    // (constant height, contour-PINNING endpoints).
    const constraintLines = [
      ...shell.profiles.map((p) => ({
        polyline: expandShellProfileArcs(p.polyline),
        inheritEndpoints: true,
      })),
      ...(isoPartition?.isoChords || []).map((c) => ({
        polyline: (c?.polyline || []).map((p) => ({
          x: p.x,
          y: p.y,
          height: Number(c?.height) || 0,
        })),
        inheritEndpoints: false,
      })),
    ];
    isoPartition = null; // absorbed above

    // Resolve crossings once (shared junction vertex objects + averaged
    // heights) — used by both modes.
    const prepared = prepareShellProfiles({ profiles: constraintLines });

    // 3D profile ridge segments (drawn by the caller as surface lines).
    shellProfileSegments = [];
    for (const prof of prepared) {
      const pl = prof.polyline;
      for (let i = 0; i < pl.length - 1; i++) {
        shellProfileSegments.push([
          pl[i].x,
          pl[i].y,
          verticalLift + height + (pl[i].height || 0) + zFightOffset,
          pl[i + 1].x,
          pl[i + 1].y,
          verticalLift + height + (pl[i + 1].height || 0) + zFightOffset,
        ]);
      }
    }

    const wantDome = shell.mode !== "TENT";
    if (wantDome) {
      const domeTri = buildDomeTopMesh(contour, validHoles, prepared);
      if (domeTri) {
        contour = domeTri.augContour;
        validHoles = domeTri.augHoles;
        bandedTris = domeTri.tris;
        extraPts = domeTri.extraPoints;
        shellApplied = "DOME";
      }
    }
    if (!shellApplied) {
      const part = partitionPolygonByChords({
        contour,
        holes: validHoles,
        chords: prepared.map((p) => ({
          polyline: p.polyline,
          inheritEndpoints: p.inheritEndpoints,
        })),
      });
      if (part) {
        contour = part.augContour;
        validHoles = part.augHoles;
        bandedTris = part.tris;
        extraPts = part.extraPoints;
        isoPartitionApplied = true; // planar strips → sketch fold edges
        shellApplied = "TENT";
      }
    }
    // TENT failure (e.g. chords crossing a hole) falls back to the DOME
    // drape, which handles holes natively; then plain per-vertex-z earcut.
    if (!shellApplied && !wantDome) {
      const domeTri = buildDomeTopMesh(contour, validHoles, prepared);
      if (domeTri) {
        contour = domeTri.augContour;
        validHoles = domeTri.augHoles;
        bandedTris = domeTri.tris;
        extraPts = domeTri.extraPoints;
        shellApplied = "DOME";
      }
    }
  }

  if (isoPartition?.isoChords?.length) {
    const part = partitionPolygonByIsoLines({
      contour,
      holes: validHoles,
      isoChords: isoPartition.isoChords,
    });
    if (part) {
      contour = part.augContour;
      validHoles = part.augHoles;
      bandedTris = part.tris;
      extraPts = part.extraPoints;
      isoPartitionApplied = true;
    }
  }

  // --- ISO-BANDED TOP (guideLine ramp): rebuild contour + top triangles so
  // every iso-height segment is an edge shared by the band faces above and
  // below it. Walls / bottom / quantities then run on the SAME augmented
  // contour, keeping the mesh and the area/volume figures consistent.
  if (
    !bandedTris &&
    isoBandLevels > 0 &&
    validHoles.length === 0 &&
    validInnerEarly.length === 0
  ) {
    const zOf = (p) =>
      verticalLift + height + (p.offsetBottom ?? 0) + (p.offsetTop ?? 0);
    const banding = computeIsoBanding(contour, zOf, isoBandLevels);
    if (banding) {
      contour = banding.augContour;
      bandedTris = banding.tris;
      isoSegments = banding.isoSegments;
    }
  }

  // Vector2 lists for THREE.ShapeUtils.triangulateShape
  const contourV2 = contour.map((p) => new Vector2(p.x, p.y));
  const holesV2 = validHoles.map((h) => h.map((p) => new Vector2(p.x, p.y)));

  // triangulateShape returns triangle index triplets [i, j, k] over the
  // concatenated [contour, ...holes] flat array.
  let tris = bandedTris || ShapeUtils.triangulateShape(contourV2, holesV2) || [];

  let flatPts = [contour, ...validHoles].flat();
  // Iso-chord interior vertices (shared fold points) sit after the rings in
  // the flat layout — see partitionPolygonByIsoLines.
  if (extraPts.length > 0) flatPts = flatPts.concat(extraPts);

  // Steiner points (POLYGON innerPoints) — each interior point becomes a new
  // vertex in the mesh, splitting the triangle that contains it into three
  // sub-triangles. This makes interior offsetBottom / offsetTop deform the
  // top face like a tent pole.
  const validInner = dedupeByCoord(
    (innerPoints || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
  );
  if (validInner.length > 0) {
    const result = insertSteinerPoints(tris, flatPts, validInner);
    tris = result.tris;
    flatPts = result.flatPts;
  }
  const isExtruded = height > 0;

  const positions = [];
  const indices = [];

  // 1. TOP FACE — one vertex per flat point, lifted to its top z.
  const topBase = 0;
  for (const p of flatPts) {
    const z =
      verticalLift + height + (p.offsetBottom ?? 0) + (p.offsetTop ?? 0) + zFightOffset;
    positions.push(p.x, p.y, z);
  }
  const topStart = indices.length;
  for (const [a, b, c] of tris) {
    indices.push(topBase + a, topBase + b, topBase + c);
  }
  const topRange = [topStart, indices.length - topStart];

  let bottomRange = [0, 0];
  let sideRange = [0, 0];
  let bottomBase = -1;

  if (isExtruded) {
    // 2. BOTTOM FACE — same vertices at bottom z, reversed winding so the
    // normal points downward.
    bottomBase = positions.length / 3;
    for (const p of flatPts) {
      const z = verticalLift + (p.offsetBottom ?? 0) + zFightOffset;
      positions.push(p.x, p.y, z);
    }
    const bottomStart = indices.length;
    for (const [a, b, c] of tris) {
      indices.push(bottomBase + a, bottomBase + c, bottomBase + b);
    }
    bottomRange = [bottomStart, indices.length - bottomStart];

    // 3. SIDE WALLS — outer contour and each hole. For holes, reverse winding
    // so the wall faces inward (toward the hole).
    const sideStart = indices.length;
    emitRingWalls(positions, indices, contour, height, verticalLift, zFightOffset, false);
    for (const h of validHoles) {
      emitRingWalls(positions, indices, h, height, verticalLift, zFightOffset, true);
    }
    sideRange = [sideStart, indices.length - sideStart];
  }

  // 4. QUANTITIES — areas computed from the actual 3D vertex positions.
  const areaPlanar = ringPlanarArea(contour) - validHoles.reduce((s, h) => s + ringPlanarArea(h), 0);
  const areaTop = sumTriangleAreas3D(positions, indices, topRange);
  const areaBottom = isExtruded
    ? sumTriangleAreas3D(positions, indices, bottomRange)
    : 0;
  const areaSides = isExtruded
    ? sumTriangleAreas3D(positions, indices, sideRange)
    : 0;

  // Volume of the slanted prism: per top triangle, the prism above its planar
  // footprint has volume = planarTriArea * avgVerticalSpan, where
  // avgVerticalSpan = avg(top_z - bottom_z) over the triangle's three vertices.
  let volume = 0;
  if (isExtruded) {
    for (const [a, b, c] of tris) {
      const planarArea = Math.abs(triPlanarArea(flatPts[a], flatPts[b], flatPts[c]));
      const spanA = height + (flatPts[a].offsetTop ?? 0);
      const spanB = height + (flatPts[b].offsetTop ?? 0);
      const spanC = height + (flatPts[c].offsetTop ?? 0);
      volume += planarArea * ((spanA + spanB + spanC) / 3);
    }
  }

  const k2 = unitScale * unitScale;
  const k3 = k2 * unitScale;

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    // Clean transverse iso-height segments [ax,ay,az, bx,by,bz, ...], aligned
    // with the band boundaries of the mesh. Null when banding didn't apply.
    isoSegments,
    // True when the explicit iso-chord partition replaced the top
    // triangulation (callers then draw planar sketch edges).
    isoPartitionApplied,
    // "DOME" | "TENT" | null — which shell build actually applied.
    shellApplied,
    // 3D ridge segments along the shell profiles ([ax,ay,az, bx,by,bz][]),
    // null when no shell profiles were passed.
    shellProfileSegments,
    topRange,
    bottomRange,
    sideRange,
    areaPlanar: areaPlanar * k2,
    areaTop: areaTop * k2,
    areaBottom: areaBottom * k2,
    areaSides: areaSides * k2,
    volume: volume * k3,
  };
}

// Insert points along a ring's segments so no edge exceeds `maxLen`
// (offsets lerped). The added points are collinear with their segment, so the
// ring GEOMETRY (walls, bottom, areas) is unchanged — only the sampling is
// finer.
function densifyRing(ring, maxLen) {
  const out = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    out.push(a);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(len / maxLen);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        type: "square",
        offsetBottom:
          (a.offsetBottom ?? 0) +
          ((b.offsetBottom ?? 0) - (a.offsetBottom ?? 0)) * t,
        offsetTop:
          (a.offsetTop ?? 0) + ((b.offsetTop ?? 0) - (a.offsetTop ?? 0)) * t,
      });
    }
  }
  return out;
}

// DOME top mesh: drape Steiner field (computeDomeSteinerField) + Delaunay
// triangulation of [augContour, augHoles, field]. The rings are DENSIFIED to
// the field's half grid spacing first — an unconstrained Delaunay only keeps
// a boundary edge whose diametral circle is empty, so ring edges must be
// SHORTER than the interior point spacing or the mesh cuts corners and
// bridges the holes (jagged star-shaped rims). Densified points are collinear
// with their segments, so walls / bottom / areas built on the augmented rings
// are geometrically identical. Returns { augContour, augHoles, tris,
// extraPoints } in the flatPts layout [augContour, ...augHoles,
// ...extraPoints], or null when the mesh cannot be trusted (field failed,
// Delaunay failed, or the triangulation does not cover the polygon area).
// The caller then falls back to the TENT partition.
function buildDomeTopMesh(rawContour, holes, preparedProfiles) {
  const spacing = computeDomeGridSpacing(rawContour);
  if (!spacing) return null;
  const contour = densifyRing(rawContour, spacing / 2);
  const validHoles = (holes || [])
    .filter((h) => Array.isArray(h) && h.length >= 3)
    .map((h) => densifyRing(h, spacing / 2));
  const result = computeDomeSteinerField({
    contour,
    holes: validHoles,
    profiles: preparedProfiles,
  });
  const field = result?.points;
  if (!field?.length) return null;

  // The sheet stops SHARP at a cut: hole rim vertices carry the DRAPE height
  // (not their own offsets), so the top face ends at the sheet level and the
  // hole wall becomes a vertical cliff — instead of the surface being pulled
  // down to the ring offsets (crater artifact).
  for (const hole of validHoles) {
    for (const p of hole) {
      p.offsetTop = result.drapeAt(p);
    }
  }

  // Dedupe field points against the ring vertices and one another —
  // duplicate points make Delaunay degenerate.
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of contour) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY);
  if (!Number.isFinite(diag) || diag < 1e-9) return null;
  const WELD_2 = (diag * 1e-4) ** 2;
  const ringPts = [...contour, ...validHoles.flat()];
  const kept = [];
  for (const p of field) {
    let dup = false;
    for (const q of ringPts) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (dx * dx + dy * dy < WELD_2) {
        dup = true;
        break;
      }
    }
    if (!dup) {
      for (const q of kept) {
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        if (dx * dx + dy * dy < WELD_2) {
          dup = true;
          break;
        }
      }
    }
    if (!dup) kept.push(p);
  }
  if (kept.length === 0) return null;

  const extraPoints = kept.map((p) => ({
    x: p.x,
    y: p.y,
    type: "square",
    offsetBottom: 0,
    offsetTop: p.offsetTop,
  }));

  // Point order MUST match the flatPts layout the caller builds:
  // [contour, ...holes, ...extraPoints].
  const allPts = [...contour, ...validHoles.flat(), ...extraPoints];
  const delTris = delaunayTriangulate(allPts);
  if (!delTris) return null;

  // Keep triangles whose centroid lies inside the polygon and outside every
  // hole (Delaunay covers the convex hull; pockets and holes must be
  // dropped).
  const inRing = (p, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
    return inside;
  };
  // Normalize winding to the contour's (Delaunay output is arbitrary; mixed
  // winding would flip vertex normals per-face and break the shading).
  let ringArea2 = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    ringArea2 += a.x * b.y - b.x * a.y;
  }
  const outerSign = Math.sign(ringArea2);
  if (outerSign === 0) return null;

  const tris = [];
  let covered = 0;
  for (let [a, b, c] of delTris) {
    const centroid = {
      x: (allPts[a].x + allPts[b].x + allPts[c].x) / 3,
      y: (allPts[a].y + allPts[b].y + allPts[c].y) / 3,
    };
    if (!inRing(centroid, contour)) continue;
    let inHole = false;
    for (const hole of validHoles) {
      if (inRing(centroid, hole)) {
        inHole = true;
        break;
      }
    }
    if (inHole) continue;
    const area = triPlanarArea(allPts[a], allPts[b], allPts[c]);
    if (Math.sign(area) !== outerSign) {
      const tmp = b;
      b = c;
      c = tmp;
    }
    tris.push([a, b, c]);
    covered += Math.abs(area);
  }
  if (tris.length === 0) return null;

  // Coverage self-check: the kept triangles must tile the polygon minus its
  // holes (missing ring edges would leave cracks along the boundaries).
  const polyArea =
    ringPlanarArea(contour) -
    validHoles.reduce((s, h) => s + ringPlanarArea(h), 0);
  if (!(polyArea > 0) || Math.abs(covered - polyArea) > polyArea * 0.01) {
    return null;
  }

  return { augContour: contour, augHoles: validHoles, tris, extraPoints };
}

// Re-mesh the TOP as iso-height bands. Returns { augContour, tris } where the
// contour is subdivided at every iso level so each band is a quad between two
// consecutive iso segments (which are therefore shared mesh edges), or null
// when banding can't apply (flat, or the two boundary rails aren't z-monotone
// — i.e. not a clean ramp).
function computeIsoBanding(contour, zOf, M) {
  const N = contour.length;
  if (N < 3) return null;
  const z = contour.map(zOf);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const v of z) {
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
  }
  if (!Number.isFinite(zMin) || !Number.isFinite(zMax) || zMax - zMin < 1e-4) {
    return null;
  }
  const EPS = Math.max(1e-6, (zMax - zMin) * 1e-6);

  // Cut levels = M interior iso levels ∪ every original vertex z, so no band
  // contains an un-paired original vertex.
  const levelSet = [];
  const addLevel = (L) => {
    if (L < zMin - EPS || L > zMax + EPS) return;
    for (const e of levelSet) if (Math.abs(e - L) <= EPS) return;
    levelSet.push(L);
  };
  for (const v of z) addLevel(v);
  for (let i = 1; i <= M; i++) addLevel(zMin + ((zMax - zMin) * i) / (M + 1));
  levelSet.sort((a, b) => a - b);
  const snap = (L) => {
    for (const e of levelSet) if (Math.abs(e - L) <= EPS) return e;
    return L;
  };

  // Augmented ring: original vertices + a point wherever an edge crosses a
  // level (interpolating x/y and the offsets so its z equals the level).
  const aug = [];
  for (let i = 0; i < N; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % N];
    const za = z[i];
    const zb = z[(i + 1) % N];
    aug.push({ ...a, _z: snap(za) });
    const lo = Math.min(za, zb);
    const hi = Math.max(za, zb);
    let crossings = levelSet.filter((L) => L > lo + EPS && L < hi - EPS);
    if (za > zb) crossings = crossings.reverse();
    for (const L of crossings) {
      const t = (L - za) / (zb - za);
      aug.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        type: "square",
        offsetBottom:
          (a.offsetBottom ?? 0) +
          ((b.offsetBottom ?? 0) - (a.offsetBottom ?? 0)) * t,
        offsetTop:
          (a.offsetTop ?? 0) + ((b.offsetTop ?? 0) - (a.offsetTop ?? 0)) * t,
        _z: L,
      });
    }
  }
  const AN = aug.length;
  if (AN < 3) return null;

  let mn = 0;
  let mx = 0;
  for (let i = 0; i < AN; i++) {
    if (aug[i]._z < aug[mn]._z) mn = i;
    if (aug[i]._z > aug[mx]._z) mx = i;
  }
  if (mn === mx) return null;

  const chain = (from, to) => {
    const out = [];
    let i = from;
    for (;;) {
      out.push(i);
      if (i === to) break;
      i = (i + 1) % AN;
      if (out.length > AN) return null;
    }
    return out;
  };
  const railA = chain(mn, mx);
  const railBraw = chain(mx, mn);
  if (!railA || !railBraw) return null;
  const railB = railBraw.slice().reverse(); // mn → mx, like railA

  const monotone = (rail) => {
    for (let i = 1; i < rail.length; i++) {
      if (aug[rail[i]]._z < aug[rail[i - 1]]._z - EPS) return false;
    }
    return true;
  };
  if (!monotone(railA) || !monotone(railB)) return null;

  // Rail-index of the FIRST vertex with z == L. Returning the LAST occurrence
  // is also useful when several adjacent vertices share a level (a "flat edge"
  // typically at the polygon's apex on min/max z).
  const firstAtLevel = (rail, L) => {
    for (let i = 0; i < rail.length; i++) {
      if (Math.abs(aug[rail[i]]._z - L) <= EPS) return i;
    }
    return -1;
  };
  const lastAtLevel = (rail, L) => {
    for (let i = rail.length - 1; i >= 0; i--) {
      if (Math.abs(aug[rail[i]]._z - L) <= EPS) return i;
    }
    return -1;
  };

  const tris = [];
  const pushTri = (p, q, r) => {
    if (p === q || q === r || p === r) return;
    tris.push([p, q, r]);
  };
  // Each band's boundary polygon = rail A from its first vertex at Lk to its
  // first vertex at Lk+1, then rail B from its first vertex at Lk+1 back down
  // to its last vertex at Lk. This naturally includes every flat-edge vertex
  // (multiple sommets au même z) as a real corner of the band — so the shared
  // 2D boundary between two annotations at constant height becomes a real
  // mesh edge instead of being absorbed into a degenerate triangle.
  for (let k = 0; k < levelSet.length - 1; k++) {
    const Lk = levelSet[k];
    const Lk1 = levelSet[k + 1];
    const aIn = firstAtLevel(railA, Lk);
    const aOut = firstAtLevel(railA, Lk1);
    const bIn = lastAtLevel(railB, Lk);
    const bOut = firstAtLevel(railB, Lk1);
    if (aIn < 0 || aOut < 0 || bIn < 0 || bOut < 0) continue;
    if (aOut < aIn || bOut < bIn) continue;

    const polyVerts = [];
    const seen = new Set();
    const push = (idx) => {
      if (!seen.has(idx)) {
        seen.add(idx);
        polyVerts.push(idx);
      }
    };
    // Up railA (low → high).
    for (let i = aIn; i <= aOut; i++) push(railA[i]);
    // Down railB (high → low).
    for (let i = bOut; i >= bIn; i--) push(railB[i]);

    if (polyVerts.length < 3) continue;
    // Fan-triangulate from polyVerts[0]. The bands are simple-ish polygons
    // (z-monotone strips), so a fan is safe.
    for (let i = 1; i < polyVerts.length - 1; i++) {
      pushTri(polyVerts[0], polyVerts[i], polyVerts[i + 1]);
    }
  }
  if (tris.length === 0) return null;

  // Visible iso lines: one clean transverse segment per evenly-spaced display
  // level, connecting the railA vertex to the railB vertex at that level. These
  // are real band boundaries of the mesh, so the lines stay aligned with the
  // surface and regular along the whole ramp (unlike a separate retriangulation
  // with a farthest-pair heuristic). Original-vertex levels are excluded so the
  // spacing stays even.
  const isoSegments = [];
  for (let i = 1; i <= M; i++) {
    const L = snap(zMin + ((zMax - zMin) * i) / (M + 1));
    const ia = firstAtLevel(railA, L);
    const ib = firstAtLevel(railB, L);
    if (ia < 0 || ib < 0) continue;
    const pa = aug[railA[ia]];
    const pb = aug[railB[ib]];
    isoSegments.push([pa.x, pa.y, L, pb.x, pb.y, L]);
  }

  const augContour = aug.map(({ _z, ...p }) => p);
  return { augContour, tris, isoSegments };
}

function emptyResult() {
  return {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
    topRange: [0, 0],
    bottomRange: [0, 0],
    sideRange: [0, 0],
    areaPlanar: 0,
    areaTop: 0,
    areaBottom: 0,
    areaSides: 0,
    volume: 0,
  };
}

// Per consecutive pair (p_i, p_{i+1}) on a closed ring, push a quad with
// per-point bottom/top z. Reverse winding for hole rings.
function emitRingWalls(positions, indices, ring, height, verticalLift, zFightOffset, reverseWinding) {
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i];
    const b = ring[j];
    const aBot = verticalLift + (a.offsetBottom ?? 0) + zFightOffset;
    const bBot = verticalLift + (b.offsetBottom ?? 0) + zFightOffset;
    const aTop =
      verticalLift + height + (a.offsetBottom ?? 0) + (a.offsetTop ?? 0) + zFightOffset;
    const bTop =
      verticalLift + height + (b.offsetBottom ?? 0) + (b.offsetTop ?? 0) + zFightOffset;
    const v0 = positions.length / 3;
    positions.push(a.x, a.y, aBot, b.x, b.y, bBot, b.x, b.y, bTop, a.x, a.y, aTop);
    if (reverseWinding) {
      indices.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
    } else {
      indices.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
    }
  }
}

// 2D shoelace (signed area absolute value) for a closed ring.
function ringPlanarArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function triPlanarArea(a, b, c) {
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

// Drop interior points whose (x, y) duplicate one another within ε, keeping
// the first occurrence. Avoids degenerate sub-triangles when the same logical
// point ends up listed twice.
function dedupeByCoord(pts, eps = 1e-6) {
  const seen = new Set();
  const out = [];
  for (const p of pts) {
    const key = `${Math.round(p.x / eps)}:${Math.round(p.y / eps)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// Insert each Steiner point into the triangle that contains it, splitting that
// triangle into three sub-triangles meeting at the new vertex. Each subsequent
// inner point is inserted into the (possibly already split) current triangle
// list, so multiple inner points compose correctly.
//
// O(n × t) with n = innerPoints count and t = current triangle count. For
// hand-drawn polygons (n ≤ ~5, t ≤ ~30) this is essentially free.
function insertSteinerPoints(initialTris, initialFlatPts, innerPoints) {
  let tris = initialTris.slice();
  const flatPts = initialFlatPts.slice();

  for (const p of innerPoints) {
    const newIdx = flatPts.length;
    flatPts.push(p);

    const hostIdx = findContainingTriangle(tris, flatPts, p);
    if (hostIdx < 0) {
      // p is not strictly inside any triangle (could be exactly on an edge
      // or numerically just outside). Drop it from the mesh — it remains in
      // flatPts but does not affect the top face. The user-visible 2D handle
      // still renders at the original position.
      continue;
    }

    const [a, b, c] = tris[hostIdx];
    const subTris = [
      [newIdx, a, b],
      [newIdx, b, c],
      [newIdx, c, a],
    ];
    tris = [...tris.slice(0, hostIdx), ...subTris, ...tris.slice(hostIdx + 1)];
  }

  return { tris, flatPts };
}

// Find the index of the triangle in `tris` that contains point `p`. Returns
// -1 if no triangle contains it. Uses a strict (open) inclusion test so points
// exactly on an edge are not assigned to either side.
function findContainingTriangle(tris, flatPts, p) {
  for (let i = 0; i < tris.length; i++) {
    const [ia, ib, ic] = tris[i];
    if (pointInTriangle(p, flatPts[ia], flatPts[ib], flatPts[ic])) {
      return i;
    }
  }
  return -1;
}

// Strict point-in-triangle test using sign of cross products. Returns true
// only if all three signs match (point is strictly inside, not on an edge).
function pointInTriangle(p, a, b, c) {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function sign(p, q, r) {
  return (p.x - r.x) * (q.y - r.y) - (q.x - r.x) * (p.y - r.y);
}

// Sum 3D triangle areas in the [start, count] index slice using the actual
// vertex positions in the buffer. Each triple of indices forms one triangle.
function sumTriangleAreas3D(positions, indices, [start, count]) {
  let total = 0;
  for (let k = 0; k < count; k += 3) {
    const i0 = indices[start + k] * 3;
    const i1 = indices[start + k + 1] * 3;
    const i2 = indices[start + k + 2] * 3;
    const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
    const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
    const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];
    // (b - a) x (c - a)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    total += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
  }
  return total;
}
