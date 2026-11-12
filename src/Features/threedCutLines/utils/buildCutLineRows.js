import { nanoid } from "@reduxjs/toolkit";

import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import buildCoteAnnotationFields from "Features/threedDrawing/utils/buildCoteAnnotationFields";
import dedupeAdjacentVertices from "Features/threedDrawing/utils/dedupeAdjacentVertices";
import resolveHostBaseMap from "Features/threedDrawing/utils/resolveHostBaseMap";

import encodeCutLineRefs from "./encodeCutLineRefs";

// Rows of CUT_LINE annotations written as given: every point is a DRAWN
// point (no extension). Same model as commitDrawnCutLineService: host base
// map, one db.points row per vertex (never shared), refs { id, offsetBottom }.
// Nothing is written here — the caller adds the rows in its own transaction
// (createCutPlaneLinesService, createCutLinesFromPromptService).
//
// lines: [{ points: [{x,y,z}], stopAtEnd? }] world polylines (a closed one
// repeats its first point; stopAtEnd: « Stop » on the last point). A line
// that does not project on a base map is skipped.
// getLabel: () => label of the next created line (createCutLineLabelAllocator)
// — called once per line actually built, never for a skipped one.
// Returns { newPoints, newAnnotations, skippedCount }.
export default function buildCutLineRows({
  lines,
  baseMaps,
  projectId,
  scopeId = null,
  templateProps = null,
  layerId = null,
  preferredBaseMapId = null,
  getLabel = null,
}) {
  const now = new Date().toISOString();
  const newPoints = [];
  const newAnnotations = [];
  let skippedCount = 0;

  for (const line of lines || []) {
    const host = resolveHostBaseMap({
      vertices: line.points,
      baseMaps,
      preferredBaseMapId,
    });
    const projected = host
      ? line.points.map((p) => worldToBaseMapNormalized(p, host))
      : null;
    if (!projected || projected.some((p) => !p)) {
      skippedCount += 1;
      continue;
    }
    const { offsetZ, points } = encodeCutLineRefs(projected);
    // Adjacent duplicates only: the closing point of a closed line is kept.
    const vertices = dedupeAdjacentVertices(points);
    if (vertices.length < 2) {
      skippedCount += 1;
      continue;
    }

    const refs = vertices.map((p, index) => {
      const id = nanoid();
      newPoints.push({
        id,
        x: p.x,
        y: p.y,
        projectId,
        baseMapId: host.id,
      });
      // « Coupe par angle »: a ray ending on the rotation axis keeps a
      // « Stop » there (a re-extension never runs past the pivot).
      const stop = line.stopAtEnd && index === vertices.length - 1;
      return {
        id,
        offsetBottom: p.offsetBottom ?? 0,
        ...(stop ? { stop: true } : {}),
      };
    });

    const label = getLabel?.();
    newAnnotations.push({
      id: nanoid(),
      projectId,
      scopeId: scopeId ?? null,
      listingId: null,
      isTemplateless: true,
      ...(label ? { label } : {}),
      baseMapId: host.id,
      ...(layerId ? { layerId } : {}),
      points: refs,
      createdAt: now,
      updatedAt: now,
      ...buildCoteAnnotationFields({
        shape: "CUT_LINE",
        classificationFields: { type: "CUT_LINE", offsetZ, height: 0 },
        templateProps,
      }),
      isDrawnIn3d: true,
    });
  }
  return { newPoints, newAnnotations, skippedCount };
}
