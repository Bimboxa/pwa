import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import resolvePoints from "Features/annotations/utils/resolvePoints";
import buildElevationProfile from "Features/elevation/utils/buildElevationProfile";
import computeMeshCells from "Features/mesh/utils/computeMeshCells";
import denormalizeMeshLines from "Features/mesh/utils/denormalizeMeshLines";
import saveMeshService from "Features/mesh/services/saveMeshService";

// Materialize the meshes described by a parsed "MESH" import JSON onto their
// EXISTING parent annotations. Cut lines come in the persisted format
// (POLYGON: [0..1] baseMap coords; POLYLINE: { u, z } per seed segment), so the
// flow is the exact inverse of the Maillage editor's save: denormalize the
// lines to world space, compute the cells, then delegate everything (points,
// cell annotations, relations, stable M-numbers, parent meshLines) to
// saveMeshService — imported meshes stay fully re-editable in the editor.
//
// Returns one result row per POLYGON entry and per POLYLINE segment:
//   [{ annotationId, mode, segIndex?, ok, cellsCount?, error? }]
// Each entry is processed independently so one failure doesn't abort the batch.

// Per-segment outline + developed range, same derivation as MeshEditor's
// segmentsInfo: tops then reversed bottoms over the vertices of that segIndex
// (including the closing vertex).
function segmentGeometry(vertices, segIndex) {
  const idxs = [];
  vertices.forEach((v, j) => {
    if (v.segIndex === segIndex) idxs.push(j);
  });
  if (!idxs.length) return null;
  const lo = Math.min(...idxs);
  const hi = Math.min(Math.max(...idxs) + 1, vertices.length - 1);
  const tops = [];
  const bottoms = [];
  let xMin = Infinity;
  let xMax = -Infinity;
  for (let k = lo; k <= hi; k++) {
    tops.push({ x: vertices[k].x, y: vertices[k].topY });
    bottoms.push({ x: vertices[k].x, y: vertices[k].bottomY });
    xMin = Math.min(xMin, vertices[k].x);
    xMax = Math.max(xMax, vertices[k].x);
  }
  return {
    outline: [...tops, ...bottoms.reverse()],
    range: { xMin, xMax },
  };
}

async function resolveParentPoints(parent, imageSize) {
  const ids = (parent.points ?? []).map((p) => p.id);
  const records = (await db.points.bulkGet(ids)).filter(Boolean);
  const pointsIndex = Object.fromEntries(records.map((r) => [r.id, r]));
  return resolvePoints({ points: parent.points, pointsIndex, imageSize });
}

export default async function importMeshService({ meshes, baseMap, dispatch }) {
  const results = [];
  const imageSize = baseMap?.getImageSize?.();
  const meterByPx = baseMap?.getMeterByPx?.() ?? null;

  for (const mesh of meshes ?? []) {
    const { annotationId, mode } = mesh;
    const fail = (error, segIndex) =>
      results.push({ annotationId, mode, segIndex, ok: false, error });
    const skip = () =>
      results.push({
        annotationId,
        mode,
        ok: false,
        skipped: true,
        error: "Aucune ligne de coupe — entrée ignorée.",
      });

    try {
      // AIs commonly emit empty entries for the annotations/segments they
      // chose not to mesh — skip them instead of erroring.
      const polylineSegments =
        mode === "POLYLINE"
          ? Object.entries(mesh.meshLinesBySegment ?? {}).filter(
              ([, lines]) => lines.length > 0
            )
          : [];
      if (
        (mode === "POLYGON" && !mesh.meshLines?.length) ||
        (mode === "POLYLINE" && !polylineSegments.length)
      ) {
        skip();
        continue;
      }

      if (!imageSize?.width) {
        fail("Fond de plan sans dimensions d'image.");
        continue;
      }

      const parent = await db.annotations.get(annotationId);
      if (!parent || parent.deletedAt) {
        fail("Annotation introuvable.");
        continue;
      }
      if (parent.type !== mode) {
        fail(`Type d'annotation (${parent.type}) différent du mode (${mode}).`);
        continue;
      }
      if (parent.baseMapId !== baseMap.id) {
        fail("Annotation sur un autre fond de plan.");
        continue;
      }

      const resolvedPx = await resolveParentPoints(parent, imageSize);
      if (!resolvedPx || resolvedPx.length < 2) {
        fail("Points de l'annotation introuvables.");
        continue;
      }

      if (mode === "POLYGON") {
        const linesWorld = denormalizeMeshLines(
          mesh.meshLines.map((l) => ({ ...l, id: nanoid() })),
          { mode: "POLYGON", imageSize }
        );
        const outline = resolvedPx.map((p) => ({ id: p.id, x: p.x, y: p.y }));
        const cells = computeMeshCells(outline, linesWorld, { meterByPx });
        if (!cells.length) {
          fail("Aucune maille calculée (lignes hors de la surface ?).");
          continue;
        }
        const { createdIds } = await saveMeshService({
          parentAnnotation: parent,
          mode: "POLYGON",
          cells,
          draftMeshLines: linesWorld,
          imageSize,
          meterByPx,
          dispatch,
        });
        results.push({
          annotationId,
          mode,
          ok: true,
          cellsCount: createdIds.length,
        });
        continue;
      }

      // POLYLINE — developed elevation, one save per seed segment (each save
      // only replaces that segment's cells).
      if (!(meterByPx > 0)) {
        fail("Fond de plan non calibré : maillage POLYLINE impossible.");
        continue;
      }
      const n = resolvedPx.length;
      const maxSegIndex = parent.closeLine ? n - 1 : n - 2;

      for (const [segKey, lines] of polylineSegments) {
        const segIndex = Number(segKey);
        try {
          if (segIndex > maxSegIndex) {
            fail(
              `Segment ${segIndex} hors limites (max ${maxSegIndex}).`,
              segIndex
            );
            continue;
          }
          // Re-fetch the parent on every iteration: saveMeshService rebuilds
          // meshLinesBySegment from the in-memory parent, so a stale object
          // would wipe the lines persisted by the previous segment's save.
          const freshParent = await db.annotations.get(annotationId);
          if (!freshParent) {
            fail("Annotation introuvable.", segIndex);
            continue;
          }
          const { vertices } = buildElevationProfile({
            points: resolvedPx,
            selectedSegmentIndices: [segIndex],
            seedSegmentIndex: segIndex,
            observationSign: 1,
            meterByPx,
            height: parseFloat(freshParent.height) || 0,
            offsetZ: Number(freshParent.offsetZ) || 0,
          });
          const geo =
            vertices?.length >= 2 && segmentGeometry(vertices, segIndex);
          if (!geo) {
            fail(
              "Élévation du segment impossible (hauteur manquante ?).",
              segIndex
            );
            continue;
          }
          const linesWorld = denormalizeMeshLines(
            lines.map((l) => ({ ...l, id: nanoid() })),
            { mode: "POLYLINE", developedRange: geo.range, meterByPx }
          );
          const cells = computeMeshCells(geo.outline, linesWorld, {
            meterByPx,
          });
          if (!cells.length) {
            fail("Aucune maille calculée sur ce segment.", segIndex);
            continue;
          }
          const { createdIds } = await saveMeshService({
            parentAnnotation: freshParent,
            mode: "POLYLINE",
            cells,
            draftMeshLines: linesWorld,
            imageSize,
            meterByPx,
            elevation: {
              chain: vertices.map((v) => ({
                x: v.x,
                plan: { x: v.px, y: v.py },
              })),
              developedRange: geo.range,
              seedSegmentIndex: segIndex,
            },
            dispatch,
          });
          results.push({
            annotationId,
            mode,
            segIndex,
            ok: true,
            cellsCount: createdIds.length,
          });
        } catch (err) {
          console.error(
            "[importMeshService] segment failed",
            annotationId,
            segKey,
            err
          );
          fail(`Erreur inattendue : ${err.message}`, segIndex);
        }
      }
    } catch (err) {
      console.error("[importMeshService] mesh entry failed", annotationId, err);
      fail(`Erreur inattendue : ${err.message}`);
    }
  }

  return results;
}
