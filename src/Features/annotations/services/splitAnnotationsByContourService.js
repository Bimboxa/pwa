import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from "polygon-clipping";

import db from "App/db/db";
import getAnnotationBBox from "Features/annotations/utils/getAnnotationBbox";
import {
  expandArcsInPath,
  expandArcsInPathWithHiddenMap,
  typeOf,
} from "Features/geometry/utils/arcSampling";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";
import splitPolylineByClosedContour from "Features/geometry/utils/splitPolylineByClosedContour";
import {
  SEGMENT_FLAG_FIELDS,
  SEGMENT_FLAG_ID_FIELD_BY_IDX_FIELD,
  segmentIdxToPointIds,
} from "Features/annotations/utils/segmentFlags";

// Tessellation count for S-C-S arcs before boolean/crossing ops — matches
// avoidVisibleAnnotationsService / getStripePolygons.
const ARC_SAMPLES = 16;
// Boolean-op result pieces below this area (px²) are numeric slivers.
const MIN_PIECE_AREA = 4;

const toRing = (points) => {
  const ring = points.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
};

const ringArea = (ring) => {
  let s = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(s / 2);
};

const fromRing = (ring) => {
  // polygon-clipping rings repeat the first vertex at the end — drop it
  const pts = ring.map(([x, y]) => ({ x, y }));
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 1 && first.x === last.x && first.y === last.y) pts.pop();
  return pts;
};

const hasArcs = (points) => (points ?? []).some((p) => typeOf(p) === "circle");

// Remap a segment-indexed field (e.g. hiddenSegmentsIdx) onto a chain whose
// segments carry their source segment index.
const remapSegField = (fieldIdx, srcSegIdx) => {
  if (!Array.isArray(fieldIdx) || fieldIdx.length === 0) return undefined;
  const src = new Set(fieldIdx);
  const out = [];
  srcSegIdx.forEach((srcIdx, newIdx) => {
    if (src.has(srcIdx)) out.push(newIdx);
  });
  return out.length > 0 ? out : undefined;
};

const EMPTY_RESULT = () => ({
  pointsToSave: [],
  annotationUpdates: [],
  newAnnotationRows: [],
  newMappingRels: [],
  linkedAnnotationIds: [],
  sourceIdByNewRowId: {},
  splitCount: 0,
});

// Sorts `annotations` against a closed contour (a POLYGON annotation, its cuts
// being holes): finds the ones lying inside it and splits the POLYGON /
// POLYLINE / STRIP annotations crossed by its perimeter so that only the inner
// part counts as inside. Same boolean pipeline as "évider"
// (useCommitHollowOut) for polygons; centerline chain-split for
// polylines/strips; point-based annotations are inside when every vertex is.
//
// Reads the db (raw rows of the split annotations, their templates) but
// WRITES NOTHING: the caller applies the batches in one transaction, together
// with the rels of its own model (zone / business object) for
// `linkedAnnotationIds`.
//
// contourAnnotation / annotations: RESOLVED annotations (pixel points). The
// caller filters out what must never be a candidate; the same-base-map and
// bbox filters are applied here.
// imageSize: {width, height} of the base map image (points are stored
// normalized).
// => { pointsToSave, annotationUpdates: [{id, changes}], newAnnotationRows,
//      newMappingRels, linkedAnnotationIds (existing ids AND new piece ids),
//      sourceIdByNewRowId: {pieceId: source annotation id}, splitCount }
export default async function splitAnnotationsByContourService({
  contourAnnotation,
  annotations,
  imageSize,
}) {
  if (
    contourAnnotation?.type !== "POLYGON" ||
    (contourAnnotation.points?.length ?? 0) < 3 ||
    !imageSize?.width ||
    !imageSize?.height
  )
    return EMPTY_RESULT();
  const { width, height } = imageSize;

  // zone geometry (pixel space, arcs tessellated)
  const zoneOuter = expandArcsInPath(
    contourAnnotation.points,
    ARC_SAMPLES,
    true
  );
  const zoneHoles = (contourAnnotation.cuts ?? [])
    .map((c) => expandArcsInPath(c.points ?? [], ARC_SAMPLES, true))
    .filter((h) => h.length >= 3);
  const zoneGeom = [toRing(zoneOuter), ...zoneHoles.map(toRing)];
  const insideZone = (pt) =>
    pointInPolygon(pt, zoneOuter) &&
    !zoneHoles.some((h) => pointInPolygon(pt, h));

  const zoneBbox = getAnnotationBBox({
    points: contourAnnotation.points,
    cuts: [],
  });
  if (!zoneBbox) return EMPTY_RESULT();

  // candidates: visible annotations of the same base map
  const TOL = 2;
  const candidates = (annotations ?? []).filter((a) => {
    if (!a || a.id === contourAnnotation.id) return false;
    if (a.baseMapId !== contourAnnotation.baseMapId) return false;
    if (!a.points?.length) return false;
    const bb = getAnnotationBBox(a);
    if (!bb) return false;
    return (
      bb.x + bb.width >= zoneBbox.x - TOL &&
      bb.x <= zoneBbox.x + zoneBbox.width + TOL &&
      bb.y + bb.height >= zoneBbox.y - TOL &&
      bb.y <= zoneBbox.y + zoneBbox.height + TOL
    );
  });
  if (candidates.length === 0) return EMPTY_RESULT();

  // write batches
  const pointsToSave = [];
  const annotationUpdates = []; // [{id, changes}]
  const newAnnotationRows = [];
  const linkedAnnotationIds = []; // ids to link to the zone
  const templateIdByNewRowId = {}; // for mapping-category rels
  const sourceIdByNewRowId = {}; // split piece → source annotation
  let splitCount = 0;

  const keyOf = (x, y) =>
    `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
  // Rewritten geometries are always tessellated (arcs expanded before the
  // boolean / chain split), so refs never carry type "circle": an original
  // arc-control id resurfacing in a tessellated ring would create a
  // spurious arc with its new neighbors.
  const asRef = (px) => ({ id: px.id });

  for (const annotation of candidates) {
    const pointScope = {
      baseMapId: annotation.baseMapId,
      projectId: annotation.projectId,
      listingId: annotation.listingId,
    };
    const mint = (px) => {
      const newId = nanoid();
      pointsToSave.push({
        id: newId,
        x: px.x / width,
        y: px.y / height,
        ...pointScope,
      });
      return { id: newId };
    };
    // reuse the id of an unchanged vertex, mint for new ones (évider pattern)
    const pxLookup = new Map();
    for (const p of annotation.points) {
      if (p?.id) pxLookup.set(keyOf(p.x, p.y), p);
    }
    for (const c of annotation.cuts ?? []) {
      for (const p of c.points ?? []) {
        if (p?.id) pxLookup.set(keyOf(p.x, p.y), p);
      }
    }
    const findOrMint = (px) => {
      const existing = pxLookup.get(keyOf(px.x, px.y));
      if (existing) return asRef(existing);
      const ref = mint(px);
      pxLookup.set(keyOf(px.x, px.y), { ...px, id: ref.id });
      return ref;
    };
    // Split pieces are cloned from the RAW db record (the resolved
    // annotation carries template-enriched / display-only fields that must
    // not be persisted) — same rule as useCommitHollowOut.
    let rawRecord = null;
    const getRaw = async () => {
      if (!rawRecord) rawRecord = await db.annotations.get(annotation.id);
      return rawRecord;
    };
    const buildPieceRow = (raw, pointsPx, extra = {}) => {
      const row = { ...raw };
      delete row.id;
      delete row.entityId;
      delete row.points;
      delete row.cuts;
      // Segment flags never carry over to a piece with a rebuilt ring —
      // the caller re-supplies them (id-keyed) when a mapping exists.
      for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
        delete row[idxField];
        delete row[idField];
      }
      delete row.createdAt;
      delete row.updatedAt;
      delete row.createdByUserIdMaster;
      delete row.updatedByUserIdMaster;
      delete row.deletedAt;
      delete row.deletedByUserIdMaster;
      const id = nanoid();
      const newRow = {
        ...row,
        ...extra,
        id,
        points: pointsPx.map((p) => findOrMint(p)),
      };
      sourceIdByNewRowId[id] = annotation.id;
      if (raw.annotationTemplateId)
        templateIdByNewRowId[id] = raw.annotationTemplateId;
      return newRow;
    };

    if (annotation.type === "POLYGON") {
      // --- boolean pipeline (same as évider) ---
      const outer = expandArcsInPath(annotation.points, ARC_SAMPLES, true);
      if (outer.length < 3) continue;
      const holes = (annotation.cuts ?? [])
        .map((c) => expandArcsInPath(c.points ?? [], ARC_SAMPLES, true))
        .filter((h) => h.length >= 3);
      const annGeom = [toRing(outer), ...holes.map(toRing)];

      let insidePieces;
      let outsidePieces;
      try {
        insidePieces = polygonClipping.intersection([annGeom], [zoneGeom]);
        outsidePieces = polygonClipping.difference([annGeom], [zoneGeom]);
      } catch (e) {
        console.warn(
          "[splitAnnotationsByContour] polygon boolean failed",
          annotation.id,
          e
        );
        continue;
      }
      const clean = (multi) =>
        (multi ?? []).filter((poly) => ringArea(poly[0]) >= MIN_PIECE_AREA);
      insidePieces = clean(insidePieces);
      outsidePieces = clean(outsidePieces);

      if (insidePieces.length === 0) continue; // fully outside
      if (outsidePieces.length === 0) {
        // fully inside → just link, geometry untouched
        linkedAnnotationIds.push(annotation.id);
        continue;
      }

      // crossing → largest outside piece keeps the original record
      const raw = await getRaw();
      if (!raw) continue;
      splitCount++;
      outsidePieces.sort((a, b) => ringArea(b[0]) - ringArea(a[0]));
      const [keep, ...extraOutside] = outsidePieces;
      annotationUpdates.push({
        id: annotation.id,
        changes: {
          points: fromRing(keep[0]).map((p) => findOrMint(p)),
          cuts: keep.slice(1).map((ring) => ({
            id: nanoid(),
            points: fromRing(ring).map((p) => findOrMint(p)),
          })),
        },
      });
      for (const poly of extraOutside) {
        newAnnotationRows.push(
          buildPieceRow(raw, fromRing(poly[0]), {
            cuts: poly.slice(1).map((ring) => ({
              id: nanoid(),
              points: fromRing(ring).map((p) => findOrMint(p)),
            })),
          })
        );
      }
      for (const poly of insidePieces) {
        const row = buildPieceRow(raw, fromRing(poly[0]), {
          cuts: poly.slice(1).map((ring) => ({
            id: nanoid(),
            points: fromRing(ring).map((p) => findOrMint(p)),
          })),
        });
        newAnnotationRows.push(row);
        linkedAnnotationIds.push(row.id);
      }
    } else if (["POLYLINE", "STRIP"].includes(annotation.type)) {
      // --- centerline chain split ---
      const closed = annotation.closeLine === true;
      let centerline = annotation.points;
      // Effective segment indices from the resolved annotation (id-derived
      // by useAnnotationsV2); written back as start-point ids per chain.
      let segFields = Object.fromEntries(
        SEGMENT_FLAG_FIELDS.map(({ idxField }) => [
          idxField,
          annotation[idxField],
        ])
      );
      if (hasArcs(centerline)) {
        // tessellate arcs; segment-indexed fields translated through the
        // expansion (crossed arcs lose their arc fidelity, like in the
        // boolean tools)
        segFields = Object.fromEntries(
          Object.entries(segFields).map(([k, v]) => [
            k,
            v?.length
              ? expandArcsInPathWithHiddenMap(
                  annotation.points,
                  ARC_SAMPLES,
                  v,
                  closed
                ).hiddenSegmentsIdx
              : v,
          ])
        );
        centerline = expandArcsInPath(annotation.points, ARC_SAMPLES, closed);
      }

      const splitRes = splitPolylineByClosedContour(centerline, zoneOuter, {
        closed,
      });

      if (!splitRes) {
        // no crossing → inside only when every vertex is inside
        const allInside = centerline.every((p) => insideZone(p));
        if (allInside) linkedAnnotationIds.push(annotation.id);
        continue;
      }

      const raw = await getRaw();
      if (!raw) continue;
      splitCount++;
      const chains = splitRes.chains;
      // the first chain keeps the original record (outside first if any, so
      // the original stays "out of the zone" when possible)
      const firstKeptIdx = Math.max(
        0,
        chains.findIndex((c) => !c.inside)
      );

      chains.forEach((chain, idx) => {
        // findOrMint is idempotent per px coordinate, so these refs match
        // the ones buildPieceRow mints for the same chain.
        const chainRefs = chain.points.map((p) => findOrMint(p));
        // Chain flags → start-point ids on the chain refs (chains are open:
        // the last point starts no segment). Legacy idx fields are cleared.
        const chainFlagIds = {};
        for (const [k, v] of Object.entries(segFields)) {
          const remapped = remapSegField(v, chain.srcSegIdx);
          chainFlagIds[SEGMENT_FLAG_ID_FIELD_BY_IDX_FIELD[k]] = remapped
            ? segmentIdxToPointIds(remapped, chainRefs, { closed: false })
            : undefined;
        }
        if (idx === firstKeptIdx) {
          annotationUpdates.push({
            id: annotation.id,
            changes: {
              points: chainRefs,
              closeLine: false,
              ...chainFlagIds,
              ...Object.fromEntries(
                SEGMENT_FLAG_FIELDS.map(({ idxField }) => [idxField, undefined])
              ),
            },
          });
          if (chain.inside) linkedAnnotationIds.push(annotation.id);
        } else {
          const row = buildPieceRow(raw, chain.points, {
            closeLine: false,
          });
          for (const [idField, ids] of Object.entries(chainFlagIds)) {
            if (ids?.length) row[idField] = ids;
          }
          newAnnotationRows.push(row);
          if (chain.inside) linkedAnnotationIds.push(row.id);
        }
      });
    } else {
      // point-based annotations (MARKER, POINT, COTE, OBJECT_3D, ...):
      // link when every vertex lies inside the zone
      const allInside = annotation.points.every((p) => insideZone(p));
      if (allInside) linkedAnnotationIds.push(annotation.id);
    }
  }

  // mapping-category rels for the split pieces (same as évider)
  let newMappingRels = [];
  const templateIds = [...new Set(Object.values(templateIdByNewRowId))];
  if (templateIds.length > 0) {
    const templates = await db.annotationTemplates.bulkGet(templateIds);
    const mappingByTemplateId = {};
    for (const t of templates) {
      if (!t) continue;
      mappingByTemplateId[t.id] = (t.mappingCategories ?? [])
        .map((entry) => {
          if (typeof entry === "string") {
            const parts = entry.split(":").map((s) => s.trim());
            return parts.length === 2 && parts[0] && parts[1]
              ? { nomenclatureKey: parts[0], categoryKey: parts[1] }
              : null;
          }
          return entry?.nomenclatureKey && entry?.categoryKey ? entry : null;
        })
        .filter(Boolean);
    }
    newMappingRels = newAnnotationRows.flatMap((row) => {
      const mcs = mappingByTemplateId[templateIdByNewRowId[row.id]] ?? [];
      return mcs.map((mc) => ({
        id: nanoid(),
        annotationId: row.id,
        projectId: row.projectId,
        nomenclatureKey: mc.nomenclatureKey,
        categoryKey: mc.categoryKey,
        source: "annotationTemplate",
      }));
    });
  }

  return {
    pointsToSave,
    annotationUpdates,
    newAnnotationRows,
    newMappingRels,
    linkedAnnotationIds: [...new Set(linkedAnnotationIds)],
    sourceIdByNewRowId,
    splitCount,
  };
}
