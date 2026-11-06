import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

// Annotations a Krto creation configuration draws on its own base maps
// (base map item field `annotations`, see the schema in resolveAppConfig) —
// e.g. a caption telling what the blank page is for, a construction outline.
//
// Each seed targets a template of a library the configuration loads:
//   { libraryKey,                 // annotation library (= preset listing) key
//     templateCategory,           // mappingCategory of the template, or
//     templateLabel,              // its label (category wins)
//     type,                       // "FREE_TEXT" | "POLYLINE" | "POLYGON"
//     props,                      // optional annotation props over the
//                                 // template's (fontSize, width, label…)
//     // FREE_TEXT
//     textContent,
//     point: { x, y },            // box CENTRE, normalized [0..1] in the image
//     // POLYLINE / POLYGON — one of:
//     pointsM: [[x, y], ...],     // meters around the image centre (x right,
//                                 // y down) — needs the base map scale
//     points: [[x, y], ...],      // normalized [0..1] in the image
//     closeLine }                 // POLYLINE only
//
// A seed whose library was removed in the recap, whose template is missing
// or whose geometry cannot be resolved is skipped (console.warn): seeding
// never blocks the scope creation.
//
// Point coordinates go to db.points, normalized (annotation.points holds the
// {id} refs — docs/annotations/POINTS_STORAGE.md). Everything is written in
// ONE transaction; the caller dispatches the annotations refresh once.

const LINE_TYPES = ["POLYLINE", "POLYGON"];

const isFiniteXY = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

function findTemplate(templates, seed) {
  if (seed.templateCategory) {
    const byCategory = templates.find((t) =>
      (t.mappingCategories ?? []).includes(seed.templateCategory)
    );
    if (byCategory) return byCategory;
  }
  if (!seed.templateLabel) return null;
  const wanted = seed.templateLabel.trim().toLowerCase();
  return (
    templates.find((t) => (t.label ?? "").trim().toLowerCase() === wanted) ??
    null
  );
}

// Seed vertices → normalized image points, or null when unresolvable.
function resolveNormalizedPoints(seed, { imageSize, meterByPx }) {
  if (Array.isArray(seed.pointsM)) {
    if (!(meterByPx > 0)) return null;
    const widthM = imageSize.width * meterByPx;
    const heightM = imageSize.height * meterByPx;
    return seed.pointsM.map(([x, y]) => ({
      x: 0.5 + x / widthM,
      y: 0.5 + y / heightM,
    }));
  }
  if (Array.isArray(seed.points)) {
    return seed.points.map(([x, y]) => ({ x, y }));
  }
  return null;
}

/**
 * @param {object} args
 * @param {Array<{ baseMapId, imageSize: {width, height}, meterByPx,
 *   annotations: Array<object> }>} args.seededBaseMaps created base maps
 *   with their seeds (useCreateConfigurationBaseMaps)
 * @param {Array<{ id, key }>} args.listings annotation listings created for
 *   the scope (`key` = library key)
 * @param {string} args.projectId
 * @returns {Promise<number>} number of annotations created
 */
export default async function seedConfigurationBaseMapAnnotationsService({
  seededBaseMaps,
  listings,
  projectId,
}) {
  if (!seededBaseMaps?.length || !projectId) return 0;

  // templates of each targeted library, read once

  const templatesByLibraryKey = new Map();
  async function getLibrary(libraryKey) {
    if (!templatesByLibraryKey.has(libraryKey)) {
      const listing = (listings ?? []).find((l) => l?.key === libraryKey);
      const templates = listing?.id
        ? (
            await db.annotationTemplates
              .where("listingId")
              .equals(listing.id)
              .toArray()
          ).filter((t) => !t.deletedAt)
        : [];
      templatesByLibraryKey.set(libraryKey, {
        listingId: listing?.id ?? null,
        templates,
      });
    }
    return templatesByLibraryKey.get(libraryKey);
  }

  // rows built in memory

  const annotations = [];
  const points = [];
  const rels = [];

  for (const {
    baseMapId,
    imageSize,
    meterByPx,
    annotations: seeds,
  } of seededBaseMaps) {
    if (!baseMapId || !imageSize?.width || !imageSize?.height) continue;

    for (const seed of seeds ?? []) {
      const { listingId, templates } = await getLibrary(seed.libraryKey);
      const template = listingId ? findTemplate(templates, seed) : null;
      if (!template) {
        console.warn(
          "[seedConfigurationBaseMapAnnotations] template not found, seed skipped",
          seed.libraryKey,
          seed.templateCategory ?? seed.templateLabel
        );
        continue;
      }

      const base = {
        ...getNewAnnotationPropsFromAnnotationTemplate(template),
        ...(seed.props ?? {}),
        id: nanoid(),
        projectId,
        baseMapId,
        listingId,
        annotationTemplateId: template.id,
      };

      let annotation = null;

      if (seed.type === "FREE_TEXT") {
        if (!isFiniteXY(seed.point)) continue;
        const center = { x: seed.point.x, y: seed.point.y };
        annotation = {
          ...base,
          type: "FREE_TEXT",
          // inline normalized points (LABEL geometry model): the box is
          // centred on labelPoint, targetPoint coincident (no connector)
          targetPoint: center,
          labelPoint: { ...center },
          textContent: seed.textContent ?? "",
          // the text lives in textContent; `label` stays empty like a
          // drawn text
          label: "",
        };
      } else if (LINE_TYPES.includes(seed.type)) {
        const normalized = resolveNormalizedPoints(seed, {
          imageSize,
          meterByPx,
        });
        const minPoints = seed.type === "POLYGON" ? 3 : 2;
        if (!normalized || normalized.length < minPoints) {
          console.warn(
            "[seedConfigurationBaseMapAnnotations] geometry not resolved, seed skipped",
            seed.type,
            seed.templateCategory ?? seed.templateLabel
          );
          continue;
        }
        const refs = normalized.map((p) => {
          const id = nanoid();
          points.push({
            id,
            x: p.x,
            y: p.y,
            baseMapId,
            projectId,
            listingId,
          });
          return { id };
        });
        annotation = {
          ...base,
          type: seed.type,
          points: refs,
          ...(seed.type === "POLYLINE" && {
            closeLine: Boolean(seed.closeLine),
          }),
        };
      } else {
        continue;
      }

      annotations.push(annotation);
      for (const category of template.mappingCategories ?? []) {
        const [nomenclatureKey, categoryKey] = category.split(":");
        rels.push({
          id: nanoid(),
          annotationId: annotation.id,
          projectId,
          nomenclatureKey,
          categoryKey,
          source: "annotationTemplate",
        });
      }
    }
  }

  if (annotations.length === 0) return 0;

  await db.transaction(
    "rw",
    db.points,
    db.annotations,
    db.relAnnotationMappingCategory,
    async () => {
      if (points.length > 0) await db.points.bulkAdd(points);
      await db.annotations.bulkAdd(annotations);
      if (rels.length > 0) await db.relAnnotationMappingCategory.bulkAdd(rels);
    }
  );

  return annotations.length;
}
