import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import db from "App/db/db";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import buildSlopeWallPolyline from "Features/annotations/utils/buildSlopeWallPolyline";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";

// Generates the side walls (paroies) of a sloped POLYGON as POLYLINE
// annotations. Each wall point carries inline offsetBottom (ground) / offsetTop
// (wall top) in meters so extrudePolylineWall renders the vertical band.
//
// `sides` is an array of per-side configs:
//   { side: "LEFT"|"RIGHT", profileType: "MAX"|"CONSTANT",
//     constantHeight, maxHeight, annotationTemplateId, template }
export default function useGenerateSlopeWalls() {
  const createAnnotation = useCreateAnnotation();
  const createEntity = useCreateEntity();
  const baseMap = useMainBaseMap();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  return async (annotation, sides) => {
    if (!annotation || !Array.isArray(sides) || sides.length === 0) return [];

    const imageSize = baseMap?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) {
      console.warn("[useGenerateSlopeWalls] missing baseMap imageSize");
      return [];
    }

    const created = [];

    for (const cfg of sides) {
      const wallPts = buildSlopeWallPolyline({
        annotation,
        side: cfg.side,
        profileType: cfg.profileType,
        constantHeight: cfg.constantHeight,
        maxHeight: cfg.maxHeight,
      });

      if (!wallPts || wallPts.length < 2) {
        console.warn(
          "[useGenerateSlopeWalls] no wall geometry for side",
          cfg.side
        );
        continue;
      }

      // 1. Create independent db.points (normalised) + inline refs with offsets.
      const pointRecords = [];
      const pointRefs = [];
      for (const p of wallPts) {
        const id = nanoid();
        pointRecords.push({
          id,
          x: p.x / imageSize.width,
          y: p.y / imageSize.height,
          projectId: annotation.projectId,
          baseMapId: annotation.baseMapId,
          listingId: annotation.listingId,
        });
        pointRefs.push({
          id,
          type: "square",
          offsetBottom: p.ground,
          offsetTop: p.wallTop,
        });
      }
      await db.points.bulkAdd(pointRecords);

      // 2. Owning entity (mirrors useCloneAnnotationAndEntity).
      const entity = await createEntity({
        listingId: cfg.template?.listingId || annotation.listingId,
        projectId: annotation.projectId,
      });

      // 3. The POLYLINE wall annotation.
      const newAnnotation = {
        ...getAnnotationTemplateProps(cfg.template),
        id: nanoid(),
        entityId: entity?.id,
        projectId: annotation.projectId,
        listingId: cfg.template?.listingId || annotation.listingId,
        baseMapId: annotation.baseMapId,
        type: "POLYLINE",
        closeLine: false,
        points: pointRefs,
        cuts: [],
        offsetZ: 0,
        height: 0,
        annotationTemplateId: cfg.annotationTemplateId,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      };

      const _annotation = await createAnnotation(newAnnotation);
      if (_annotation) created.push(_annotation);
    }

    return created;
  };
}
