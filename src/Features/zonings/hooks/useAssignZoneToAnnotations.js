import { useRef } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import polygonClipping from "polygon-clipping";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerRelsZoneAnnotationUpdate } from "../zoningsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import db from "App/db/db";
import getAnnotationBBox from "Features/annotations/utils/getAnnotationBbox";
import {
  expandArcsInPath,
  expandArcsInPathWithHiddenMap,
  typeOf,
} from "Features/geometry/utils/arcSampling";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";
import splitPolylineByClosedContour from "Features/geometry/utils/splitPolylineByClosedContour";

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

// "Affecter la zone": from a selected zone delimitation polygon, links every
// annotation lying inside it to the zone (relsZoneAnnotation), splitting the
// POLYGON / POLYLINE / STRIP annotations crossed by the zone perimeter so that
// only the inner part gets linked. Same boolean pipeline as "évider"
// (useHollowOutAnnotation) for polygons; centerline chain-split for
// polylines/strips.
export default function useAssignZoneToAnnotations() {
  const dispatch = useDispatch();

  // data — same filter set as useVisibleAnnotations, but solo-proof so an
  // active zone SOLO doesn't shrink the candidate set.
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const annotations = useAnnotationsV2({
    caller: "useAssignZoneToAnnotations",
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
    ignoreSolo: true,
  });
  const baseMap = useMainBaseMap();

  const runningRef = useRef(false);

  async function assignZone(zoneAnnotation) {
    if (runningRef.current) return null;
    runningRef.current = true;
    try {
      return await run(zoneAnnotation);
    } finally {
      runningRef.current = false;
    }
  }

  async function run(zoneAnnotation) {
    if (
      !zoneAnnotation?.isZoneAnnotation ||
      zoneAnnotation.type !== "POLYGON" ||
      (zoneAnnotation.points?.length ?? 0) < 3
    )
      return null;

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize?.width || !imageSize?.height) return null;
    const { width, height } = imageSize;

    // zone → template → zone row
    const template = zoneAnnotation.annotationTemplateId
      ? await db.annotationTemplates.get(zoneAnnotation.annotationTemplateId)
      : null;
    const zone = template?.zoneId ? await db.zones.get(template.zoneId) : null;
    if (!zone || zone.deletedAt) return null;

    // zone geometry (pixel space, arcs tessellated)
    const zoneOuter = expandArcsInPath(zoneAnnotation.points, ARC_SAMPLES, true);
    const zoneHoles = (zoneAnnotation.cuts ?? [])
      .map((c) => expandArcsInPath(c.points ?? [], ARC_SAMPLES, true))
      .filter((h) => h.length >= 3);
    const zoneGeom = [toRing(zoneOuter), ...zoneHoles.map(toRing)];
    const insideZone = (pt) =>
      pointInPolygon(pt, zoneOuter) &&
      !zoneHoles.some((h) => pointInPolygon(pt, h));

    const zoneBbox = getAnnotationBBox({
      points: zoneAnnotation.points,
      cuts: [],
    });
    if (!zoneBbox) return null;

    // candidates: visible annotations of the same base map
    const TOL = 2;
    const candidates = (annotations ?? []).filter((a) => {
      if (!a || a.id === zoneAnnotation.id) return false;
      if (a.isZoneAnnotation || a.isBaseMapAnnotation || a.isMeshCell)
        return false;
      if (a.baseMapId !== zoneAnnotation.baseMapId) return false;
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
    if (candidates.length === 0) return { linked: 0, split: 0 };

    // write batches
    const pointsToSave = [];
    const annotationUpdates = []; // [{id, changes}]
    const newAnnotationRows = [];
    const linkedAnnotationIds = []; // ids to link to the zone
    const templateIdByNewRowId = {}; // for mapping-category rels
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
      // not be persisted) — same rule as useHollowOutAnnotation.
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
          console.warn("[assignZone] polygon boolean failed", annotation.id, e);
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
        let segFields = {
          hiddenSegmentsIdx: annotation.hiddenSegmentsIdx,
          isoHeightSegmentsIdx: annotation.isoHeightSegmentsIdx,
          isExtEdgeSegmentsIdx: annotation.isExtEdgeSegmentsIdx,
        };
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
          const chainSegFields = {};
          for (const [k, v] of Object.entries(segFields)) {
            const remapped = remapSegField(v, chain.srcSegIdx);
            chainSegFields[k] = remapped ?? null;
          }
          if (idx === firstKeptIdx) {
            annotationUpdates.push({
              id: annotation.id,
              changes: {
                points: chain.points.map((p) => findOrMint(p)),
                closeLine: false,
                ...Object.fromEntries(
                  Object.entries(chainSegFields).map(([k, v]) => [
                    k,
                    v ?? undefined,
                  ])
                ),
              },
            });
            if (chain.inside) linkedAnnotationIds.push(annotation.id);
          } else {
            const row = buildPieceRow(raw, chain.points, {
              closeLine: false,
            });
            for (const [k, v] of Object.entries(chainSegFields)) {
              if (v) row[k] = v;
              else delete row[k];
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

    // zone links: replace-within-zoning rule, batched. Existing annotations
    // may already carry a rel on this zoning; new piece rows never do.
    const uniqueLinkIds = [...new Set(linkedAnnotationIds)];
    const existingRels =
      uniqueLinkIds.length > 0
        ? (
            await db.relsZoneAnnotation
              .where("annotationId")
              .anyOf(uniqueLinkIds)
              .toArray()
          ).filter((r) => !r.deletedAt && r.listingId === zone.listingId)
        : [];
    const relIdsToDelete = existingRels
      .filter((r) => r.zoneId !== zone.id)
      .map((r) => r.id);
    const alreadyLinked = new Set(
      existingRels.filter((r) => r.zoneId === zone.id).map((r) => r.annotationId)
    );
    const relsToAdd = uniqueLinkIds
      .filter((id) => !alreadyLinked.has(id))
      .map((annotationId) => ({
        id: nanoid(),
        projectId: zone.projectId,
        scopeId: zone.scopeId,
        annotationId,
        zoneId: zone.id,
        listingId: zone.listingId,
      }));

    if (
      pointsToSave.length === 0 &&
      annotationUpdates.length === 0 &&
      newAnnotationRows.length === 0 &&
      relIdsToDelete.length === 0 &&
      relsToAdd.length === 0
    ) {
      return { linked: alreadyLinked.size, split: 0 };
    }

    // single transaction + single dispatch wave (batch-write pattern)
    await db.transaction(
      "rw",
      [
        db.points,
        db.annotations,
        db.relAnnotationMappingCategory,
        db.relsZoneAnnotation,
      ],
      async () => {
        if (pointsToSave.length > 0) await db.points.bulkAdd(pointsToSave);
        for (const { id, changes } of annotationUpdates) {
          await db.annotations.update(id, changes);
        }
        if (newAnnotationRows.length > 0)
          await db.annotations.bulkAdd(newAnnotationRows);
        if (newMappingRels.length > 0)
          await db.relAnnotationMappingCategory.bulkAdd(newMappingRels);
        if (relIdsToDelete.length > 0)
          await db.relsZoneAnnotation.bulkDelete(relIdsToDelete);
        if (relsToAdd.length > 0)
          await db.relsZoneAnnotation.bulkAdd(relsToAdd);
      }
    );

    if (annotationUpdates.length > 0 || newAnnotationRows.length > 0)
      dispatch(triggerAnnotationsUpdate());
    dispatch(triggerRelsZoneAnnotationUpdate());

    return { linked: uniqueLinkIds.length, split: splitCount };
  }

  return assignZone;
}
