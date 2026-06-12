import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import resolveTemplateByLabel from "./resolveTemplateByLabel";
import extractDimensionsMeters from "../utils/extractDimensionsMeters";
import skill from "./skills/createAnnotations.skill.md?raw";

// Tool: create one or several annotations from normalized [0..1] coordinates.
// Points are persisted in db.points (already normalized, no conversion needed)
// and referenced by {id} in the annotation, as required by the points storage
// model (see docs/annotations/POINTS_STORAGE.md).

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

function getPointsCentroid(points) {
  const valid = (points ?? []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (valid.length === 0) return null;
  return {
    x: valid.reduce((sum, p) => sum + p.x, 0) / valid.length,
    y: valid.reduce((sum, p) => sum + p.y, 0) / valid.length,
  };
}

// Converts real-world rect dimensions (meters) into normalized [0..1] corner
// points, using the baseMap scale (meterByPx) and image size. Returns null
// when the baseMap has no usable scale.
function buildRectPointsFromMeters(item, baseMap) {
  const meterByPx =
    typeof baseMap?.getMeterByPx === "function"
      ? baseMap.getMeterByPx()
      : baseMap?.meterByPx;
  const imageSize = baseMap?.getImageSize?.() ?? baseMap?.image?.imageSize;
  if (!meterByPx || !imageSize?.width || !imageSize?.height) return null;

  const widthMeters = item.widthMeters;
  const heightMeters = item.heightMeters ?? widthMeters;
  if (!Number.isFinite(widthMeters) || widthMeters <= 0) return null;

  const w = widthMeters / meterByPx / imageSize.width;
  const h = heightMeters / meterByPx / imageSize.height;
  const cx = Number.isFinite(item.center?.x) ? item.center.x : 0.5;
  const cy = Number.isFinite(item.center?.y) ? item.center.y : 0.5;

  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

const createAnnotationsTool = {
  name: "CREATE_ANNOTATIONS",
  argsKey: "annotationsToCreate",
  whenToUse:
    "créer, dessiner ou ajouter de nouvelles annotations sur le plan (polygone, surface, carré, rectangle, triangle, polyligne, ligne, marqueur, point, forme géométrique)",
  routerExamples: [
    '"Crée un marqueur au centre" → CREATE_ANNOTATIONS',
    '"Dessine un polygone Surface 1 en haut à gauche" → CREATE_ANNOTATIONS',
    '"Crée un carré" → CREATE_ANNOTATIONS',
    '"Ajoute un rectangle en bas du plan" → CREATE_ANNOTATIONS',
    '"Crée un carré de 5m x 5m" → CREATE_ANNOTATIONS',
  ],
  skill,
  argsSchema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["POLYGON", "POLYLINE", "MARKER"] },
        templateLabel: { type: "string" },
        label: { type: "string" },
        points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
            },
            required: ["x", "y"],
          },
        },
        widthMeters: { type: "number" },
        heightMeters: { type: "number" },
        center: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
        },
      },
      required: ["type"],
    },
  },

  async execute(items, context) {
    const {
      projectId,
      listingId,
      baseMapId,
      baseMap,
      templates,
      createAnnotation,
      userText,
    } = context;

    let createdCount = 0;
    const errors = [];

    // dimensions written by the user are parsed deterministically — small
    // models echo numbers unreliably, so they override the generated args
    const parsedDims = extractDimensionsMeters(userText);

    for (const item of items ?? []) {
      const type = item.type ?? "POLYGON";
      const template = resolveTemplateByLabel(templates, item.templateLabel, {
        preferredListingId: listingId,
      });

      // the annotation belongs to the listing of its template (falls back to
      // the selected listing when no template is used)
      const annotationListingId = template?.listingId ?? listingId;

      // real-world dimensions (meters) take precedence over raw points
      let widthMeters = item.widthMeters;
      let heightMeters = item.heightMeters;
      if (type === "POLYGON" && parsedDims) {
        widthMeters = parsedDims.width;
        heightMeters = parsedDims.height;
      }

      let rawPoints = item.points ?? [];
      if (Number.isFinite(widthMeters)) {
        // keep the position the model picked (explicit center, or the
        // centroid of the points it generated)
        const center = item.center ?? getPointsCentroid(item.points);
        const rectPoints = buildRectPointsFromMeters(
          { widthMeters, heightMeters, center },
          baseMap
        );
        if (rectPoints) {
          rawPoints = rectPoints;
          const overflows = rectPoints.some(
            (p) => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1
          );
          if (overflows) {
            errors.push(
              "la forme demandée dépasse les limites du plan (tronquée)"
            );
          }
        } else {
          errors.push(
            "dimensions en mètres ignorées (échelle du plan inconnue)"
          );
        }
      }

      const pointsToAdd = rawPoints
        .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
        .map((p) => ({
          id: nanoid(),
          x: clamp01(p.x),
          y: clamp01(p.y),
          baseMapId,
          projectId,
          listingId: annotationListingId,
          forMarker: type === "MARKER",
        }));

      const minPoints = type === "MARKER" ? 1 : type === "POLYLINE" ? 2 : 3;
      if (pointsToAdd.length < minPoints) {
        errors.push(`annotation ${type} ignorée (points insuffisants)`);
        continue;
      }

      await db.points.bulkAdd(pointsToAdd);

      const annotation = await createAnnotation({
        type,
        baseMapId,
        listingId: annotationListingId,
        points: pointsToAdd.map((p) => ({ id: p.id })),
        closeLine: type === "POLYGON",
        annotationTemplateId: template?.id,
        label: item.label,
        fillColor: template?.fillColor ?? "#2196f3",
        fillOpacity: template?.fillOpacity,
        strokeColor: template?.strokeColor ?? "#2196f3",
        strokeWidth: template?.strokeWidth,
        strokeWidthUnit: template?.strokeWidthUnit,
        strokeOpacity: template?.strokeOpacity,
      });

      if (annotation) createdCount++;
      else errors.push(`échec de création (${type})`);
    }

    let summary = `✓ ${createdCount} annotation(s) créée(s).`;
    if (errors.length > 0) summary += ` ⚠ ${errors.join(", ")}`;
    return summary;
  },
};

export default createAnnotationsTool;
