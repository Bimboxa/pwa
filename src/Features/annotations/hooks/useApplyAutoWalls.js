import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerAnnotationsUpdate } from "../annotationsSlice";

import { nanoid } from "@reduxjs/toolkit";

import useSelectedAnnotation from "./useSelectedAnnotation";
import useAnnotationsV2 from "./useAnnotationsV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import buildAnnotationEdgeRings from "../utils/buildAnnotationEdgeRings";
import findSharedEdgeChains from "../utils/findSharedEdgeChains";
import computeAutoWallChains from "../utils/computeAutoWallChains";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

import db from "App/db/db";

// "Parois auto": creates the vertical walls (retombées / remontées) connecting
// the selected POLYGON's boundary (main ring + cuts) or the selected POLYLINE
// to the adjacent polygon/polyline edges (shared db.points ids or geometric
// overlap within 1 cm). Each wall is a POLYLINE annotation with per-vertex
// offsetBottom/offsetTop spanning from the lower surface's top to the higher
// surface's top — vertical sides guaranteed by extrudePolylineWall.
//
// Walls are tagged with autoGenKind + autoWallPair (sorted [selectedId,
// neighborId]) so re-running — from either side of a pair — replaces the
// existing walls instead of duplicating them.

const THRESHOLD_M = 0.01; // 1 cm adjacency tolerance

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

export default function useApplyAutoWalls() {
  const dispatch = useDispatch();

  const selectedAnnotation = useSelectedAnnotation();
  const annotations = useAnnotationsV2({
    filterByMainBaseMap: true,
    caller: "useApplyAutoWalls",
  });
  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ annotationTemplateId, template }) => {
    const selected = selectedAnnotation;
    if (!selected?.id || !["POLYGON", "POLYLINE"].includes(selected.type))
      return;

    const toast = (message, isError) =>
      dispatch(setToaster({ message, ...(isError ? { isError: true } : {}) }));

    const imageSize = baseMap?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) {
      toast("Parois auto : taille de l'image indisponible", true);
      return;
    }

    const meterByPx = baseMap?.getMeterByPx?.();
    if (!meterByPx || meterByPx <= 0) {
      toast("Parois auto : échelle du plan non définie", true);
      return;
    }

    if (!template?.id) {
      toast("Parois auto : choisir un style de paroi", true);
      return;
    }

    const thresholdPx = THRESHOLD_M / meterByPx;

    // Candidates: other surfaces on the same baseMap. Wall-like polylines
    // (previous auto walls, slope walls with per-vertex offsetBottom) are
    // excluded — their top is not a surface top, chaining walls to walls
    // creates noise. Plain-height polylines (e.g. acrotères) stay valid.
    const candidates = (annotations ?? []).filter(
      (a) =>
        ["POLYGON", "POLYLINE"].includes(a.type) &&
        a.baseMapId === selected.baseMapId &&
        a.id !== selected.id &&
        a.autoGenKind !== "AUTO_WALLS" &&
        !(
          a.type === "POLYLINE" &&
          a.points?.some(
            (p) => (p.offsetBottom ?? 0) !== 0 || (p.offsetTop ?? 0) !== 0
          )
        )
    );

    const sourceRings = buildAnnotationEdgeRings(selected);
    const neighbors = candidates
      .map((a) => ({ annotation: a, rings: buildAnnotationEdgeRings(a) }))
      .filter((n) => n.rings.length);

    const sharedChains = findSharedEdgeChains({
      sourceRings,
      neighbors,
      thresholdPx,
    });
    if (!sharedChains.length) {
      toast(
        "Parois auto : aucune arête adjacente trouvée (tolérance 1 cm)",
        true
      );
      return;
    }

    const wallChains = computeAutoWallChains({
      selectedAnnotation: selected,
      sharedChains,
      thresholdPx,
      meterByPx,
    });
    if (!wallChains.length) {
      toast("Parois auto : surfaces affleurantes, aucune paroi à créer", true);
      return;
    }

    // Stale walls of any pair involving the selected annotation: re-running
    // (from either side) replaces them instead of duplicating.
    const prevWalls = await db.annotations
      .where("baseMapId")
      .equals(selected.baseMapId)
      .filter(
        (a) =>
          !a.deletedAt &&
          a.autoGenKind === "AUTO_WALLS" &&
          Array.isArray(a.autoWallPair) &&
          a.autoWallPair.includes(selected.id)
      )
      .toArray();
    const prevAnnotationIds = prevWalls.map((a) => a.id);
    const prevPointIds = prevWalls.flatMap(
      (a) => a.points?.map((p) => p.id).filter(Boolean) ?? []
    );

    const wallListingId = template?.listingId || selected.listingId;

    // Owning entities — created OUTSIDE the Dexie transaction (createEntity
    // awaits non-Dexie async work, which would commit a transaction early).
    // Their stale counterparts are left orphaned, like existing delete flows.
    const allPointRows = [];
    const allAnnotationRows = [];
    const allRelRows = [];

    const mappingCategories = (template?.mappingCategories ?? [])
      .map(parseMappingCategory)
      .filter(Boolean);

    for (const { neighbor, pointRefs } of wallChains) {
      const entity = await createEntity({
        listingId: wallListingId,
        projectId,
      });

      const refs = [];
      for (const p of pointRefs) {
        const id = nanoid();
        allPointRows.push({
          id,
          x: p.x / imageSize.width,
          y: p.y / imageSize.height,
          projectId,
          baseMapId: selected.baseMapId,
          listingId: wallListingId,
        });
        refs.push({
          id,
          type: "square",
          offsetBottom: p.offsetBottom,
          offsetTop: p.offsetTop,
        });
      }

      const annotationId = nanoid();
      allAnnotationRows.push({
        ...getAnnotationTemplateProps(template),
        id: annotationId,
        entityId: entity?.id,
        projectId,
        listingId: wallListingId,
        baseMapId: selected.baseMapId,
        type: "POLYLINE",
        closeLine: false,
        points: refs,
        cuts: [],
        offsetZ: 0,
        height: 0,
        annotationTemplateId,
        autoCreatedFrom: selected.id,
        autoGenKind: "AUTO_WALLS",
        autoWallPair: [selected.id, neighbor.id].sort(),
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
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

    // Single transaction → the useAnnotationsV2 liveQueries re-run once.
    await db.transaction(
      "rw",
      db.points,
      db.annotations,
      db.relAnnotationMappingCategory,
      async () => {
        if (prevAnnotationIds.length) {
          await db.annotations.bulkDelete(prevAnnotationIds);
          if (prevPointIds.length) await db.points.bulkDelete(prevPointIds);
          await db.relAnnotationMappingCategory
            .where("annotationId")
            .anyOf(prevAnnotationIds)
            .delete();
        }
        await db.points.bulkAdd(allPointRows);
        await db.annotations.bulkAdd(allAnnotationRows);
        if (allRelRows.length) {
          await db.relAnnotationMappingCategory.bulkAdd(allRelRows);
        }
      }
    );
    dispatch(triggerAnnotationsUpdate());

    const count = allAnnotationRows.length;
    toast(
      `Parois auto : ${count} paroi${count > 1 ? "s" : ""} créée${count > 1 ? "s" : ""}`
    );
  };
}
