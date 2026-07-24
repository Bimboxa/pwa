import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerAnnotationsUpdate } from "../annotationsSlice";

import { nanoid } from "@reduxjs/toolkit";

import useSelectedAnnotation from "./useSelectedAnnotation";
import useAnnotationsV2 from "./useAnnotationsV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import getSelectedAnnotationWallChains from "../utils/getSelectedAnnotationWallChains";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

import db from "App/db/db";

// "Convertir en paroie": turns the SELECTED POLYLINE into a wall IN PLACE, using
// the exact same adjacency + height computation as "Parois auto"
// (getSelectedAnnotationWallChains) but writing the result onto the selected
// annotation instead of creating fresh walls.
//
// computeAutoWallChains can return several sub-chains (flush portions cut the
// wall; several adjacent neighbors). The LONGEST chain updates the selected
// annotation in place (keeps its id / entity / template / category); the other
// tronçons become new POLYLINE annotations cloning the SELECTED annotation's own
// template (its CURRENT style, not the menu one).

// same dual format as useCreateAnnotation: "OUVRAGE:VI" or
// { nomenclatureKey, categoryKey }
function parseMappingCategory(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const parts = entry.split(":");
    if (parts.length !== 2) return null;
    const [nomenclatureKey, categoryKey] = parts.map((s) => s.trim());
    if (!nomenclatureKey || !categoryKey) return null;
    return { nomenclatureKey, categoryKey };
  }
  if (entry.nomenclatureKey && entry.categoryKey) return entry;
  return null;
}

// Cumulative pixel length of a wall chain's pointRefs — used to pick the "main"
// tronçon (the one that keeps the selected annotation's identity).
function chainLengthPx(pointRefs) {
  let len = 0;
  for (let i = 1; i < pointRefs.length; i += 1) {
    len += Math.hypot(
      pointRefs[i].x - pointRefs[i - 1].x,
      pointRefs[i].y - pointRefs[i - 1].y
    );
  }
  return len;
}

export default function useConvertAnnotationToWall() {
  const dispatch = useDispatch();

  const selectedAnnotation = useSelectedAnnotation();
  const annotations = useAnnotationsV2({
    filterByMainBaseMap: true,
    caller: "useConvertAnnotationToWall",
  });
  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async () => {
    const selected = selectedAnnotation;

    const toast = (message, isError) =>
      dispatch(setToaster({ message, ...(isError ? { isError: true } : {}) }));

    // Only a POLYLINE "becomes" a wall in place (a POLYGON stays a surface —
    // "Générer" is its path).
    if (!selected?.id || selected.type !== "POLYLINE") return;

    const result = getSelectedAnnotationWallChains({
      selectedAnnotation: selected,
      annotations,
      baseMap,
    });
    if (!result.ok) {
      const message = {
        NO_IMAGE_SIZE: "Convertir en paroie : taille de l'image indisponible",
        NO_SCALE: "Convertir en paroie : échelle du plan non définie",
        NO_ADJACENT_EDGE:
          "Convertir en paroie : aucune arête adjacente trouvée (tolérance 1 cm)",
        NO_WALLS:
          "Convertir en paroie : surfaces affleurantes, aucune paroi à créer",
      }[result.errorKey];
      if (message) toast(message, true); // INVALID_SELECTION → silent
      return;
    }
    const { wallChains, imageSize } = result;

    // Keep the annotation's CURRENT template (not the menu one). Everything the
    // extra tronçons clone (style + category) comes from it.
    const selectedTemplate = selected.annotationTemplate;
    const listingId = selected.listingId;
    const mappingCategories = (selectedTemplate?.mappingCategories ?? [])
      .map(parseMappingCategory)
      .filter(Boolean);

    // Longest chain updates the selection in place; the rest are new walls.
    const sortedChains = [...wallChains].sort(
      (a, b) => chainLengthPx(b.pointRefs) - chainLengthPx(a.pointRefs)
    );
    const [mainChain, ...extraChains] = sortedChains;

    // Fresh db.points per tronçon. The selected annotation's OLD points are NOT
    // deleted — they may be shared with an adjacent polygon via the shared-id
    // fast-path in findSharedEdgeChains; truly-orphaned ones are handled by the
    // existing "Purger les suppressions".
    const buildRefs = (pointRefs) => {
      const pointRows = [];
      const refs = [];
      for (const p of pointRefs) {
        const id = nanoid();
        pointRows.push({
          id,
          x: p.x / imageSize.width,
          y: p.y / imageSize.height,
          projectId,
          baseMapId: selected.baseMapId,
          listingId,
        });
        refs.push({
          id,
          type: "square",
          offsetBottom: p.offsetBottom,
          offsetTop: p.offsetTop,
        });
      }
      return { pointRows, refs };
    };

    const allPointRows = [];
    const allAnnotationRows = []; // extra tronçons only
    const allRelRows = [];

    // Main tronçon → in-place refs for the selected annotation.
    const main = buildRefs(mainChain.pointRefs);
    allPointRows.push(...main.pointRows);
    const mainRefs = main.refs;

    // Extra tronçons → new annotations cloning the selected annotation's
    // template. Entities are created OUTSIDE the Dexie transaction (createEntity
    // awaits non-Dexie async work, which would commit a transaction early).
    for (const chain of extraChains) {
      const entity = await createEntity({ listingId, projectId });
      const { pointRows, refs } = buildRefs(chain.pointRefs);
      allPointRows.push(...pointRows);

      const annotationId = nanoid();
      allAnnotationRows.push({
        ...getAnnotationTemplateProps(selectedTemplate),
        id: annotationId,
        entityId: entity?.id,
        projectId,
        listingId,
        baseMapId: selected.baseMapId,
        type: "POLYLINE",
        closeLine: false,
        points: refs,
        cuts: [],
        offsetZ: 0,
        height: 0,
        annotationTemplateId: selected.annotationTemplateId,
        autoCreatedFrom: selected.id,
        ...(selected.layerId ? { layerId: selected.layerId } : {}),
      });

      for (const mc of mappingCategories) {
        allRelRows.push({
          id: nanoid(),
          annotationId,
          projectId,
          nomenclatureKey: mc.nomenclatureKey,
          categoryKey: mc.categoryKey,
          source: "annotationTemplate",
        });
      }
    }

    // Single transaction → the useAnnotationsV2 liveQueries re-run once. The
    // selected annotation keeps its template / style / category rels — only its
    // geometry + vertical offsets change.
    await db.transaction(
      "rw",
      db.points,
      db.annotations,
      db.relAnnotationMappingCategory,
      async () => {
        await db.points.bulkAdd(allPointRows);
        await db.annotations.update(selected.id, {
          points: mainRefs,
          height: 0,
          offsetZ: 0,
          closeLine: false,
        });
        if (allAnnotationRows.length) {
          await db.annotations.bulkAdd(allAnnotationRows);
        }
        if (allRelRows.length) {
          await db.relAnnotationMappingCategory.bulkAdd(allRelRows);
        }
      }
    );
    dispatch(triggerAnnotationsUpdate());

    const count = sortedChains.length;
    toast(`Convertie en paroi : ${count} tronçon${count > 1 ? "s" : ""}`);
  };
}
