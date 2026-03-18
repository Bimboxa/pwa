import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import { setActiveLayerId, triggerLayersUpdate } from "../layersSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

export default function useCreateLayer() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const createLayer = async ({ baseMapId, name, annotationIdsToDuplicate }) => {
    // compute orderIndex after the last existing layer
    const existing = await db.layers
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    const sorted = existing
      .filter((r) => !r.deletedAt && r.orderIndex != null)
      .map((r) => r.orderIndex)
      .sort();
    const lastIndex = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const orderIndex = generateKeyBetween(lastIndex, null);

    const layer = {
      id: nanoid(),
      baseMapId,
      projectId,
      name,
      orderIndex,
    };

    await db.layers.add(layer);

    // duplicate annotations if requested
    if (annotationIdsToDuplicate?.length > 0) {
      await duplicateAnnotations(annotationIdsToDuplicate, layer.id);
      dispatch(triggerAnnotationsUpdate());
    }

    dispatch(triggerLayersUpdate());
    dispatch(setActiveLayerId(layer.id));

    return layer;
  };

  return createLayer;
}

async function duplicateAnnotations(annotationIds, newLayerId) {
  const sourceAnnotations = (
    await db.annotations.bulkGet(annotationIds)
  ).filter(Boolean);

  // collect all referenced point IDs
  const pointIds = new Set();
  for (const ann of sourceAnnotations) {
    collectPointIds(ann, pointIds);
  }

  // fetch and duplicate points, building old ID -> new ID map
  const pointIdMap = {};
  if (pointIds.size > 0) {
    const sourcePoints = (
      await db.points.bulkGet([...pointIds])
    ).filter(Boolean);
    const newPoints = sourcePoints.map((pt) => {
      const newId = nanoid();
      pointIdMap[pt.id] = newId;
      return {
        ...pt,
        id: newId,
        createdAt: undefined,
        updatedAt: undefined,
        createdByUserIdMaster: undefined,
      };
    });
    if (newPoints.length > 0) {
      await db.points.bulkAdd(newPoints);
    }
  }

  // duplicate annotations with new IDs and remapped point references
  const newAnnotations = sourceAnnotations.map((ann) => {
    const newAnn = {
      ...ann,
      id: nanoid(),
      layerId: newLayerId,
      createdAt: undefined,
      updatedAt: undefined,
      createdByUserIdMaster: undefined,
    };
    remapPointIds(newAnn, pointIdMap);
    return newAnn;
  });

  if (newAnnotations.length > 0) {
    await db.annotations.bulkAdd(newAnnotations);
  }
}

function collectPointIds(annotation, pointIds) {
  // points array (POLYLINE, POLYGON, etc.)
  if (Array.isArray(annotation.points)) {
    for (const pt of annotation.points) {
      if (pt?.id) pointIds.add(pt.id);
    }
  }
  // cuts array
  if (Array.isArray(annotation.cuts)) {
    for (const cut of annotation.cuts) {
      if (Array.isArray(cut.points)) {
        for (const pt of cut.points) {
          if (pt?.id) pointIds.add(pt.id);
        }
      }
    }
  }
  // single point (MARKER, POINT)
  if (annotation.point?.id) {
    pointIds.add(annotation.point.id);
  }
}

function remapPointIds(annotation, pointIdMap) {
  if (Array.isArray(annotation.points)) {
    annotation.points = annotation.points.map((pt) =>
      pt?.id && pointIdMap[pt.id] ? { ...pt, id: pointIdMap[pt.id] } : pt
    );
  }
  if (Array.isArray(annotation.cuts)) {
    annotation.cuts = annotation.cuts.map((cut) => ({
      ...cut,
      points: Array.isArray(cut.points)
        ? cut.points.map((pt) =>
            pt?.id && pointIdMap[pt.id] ? { ...pt, id: pointIdMap[pt.id] } : pt
          )
        : cut.points,
    }));
  }
  if (annotation.point?.id && pointIdMap[annotation.point.id]) {
    annotation.point = {
      ...annotation.point,
      id: pointIdMap[annotation.point.id],
    };
  }
}
