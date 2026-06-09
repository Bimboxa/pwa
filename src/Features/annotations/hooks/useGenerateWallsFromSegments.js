import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import db from "App/db/db";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import buildWallPolylineFromChain from "Features/annotations/utils/buildWallPolylineFromChain";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";

// Generates wall pieces (bouts de parois) from user-selected contour segment
// chains of a (sloped) POLYGON, as POLYLINE annotations. Each wall point carries
// inline offsetBottom (ground) / offsetTop (wall top) in meters so
// extrudePolylineWall renders the vertical band.
//
// `chains` is the array of contiguous segment chains from useSelectedAnnotationPart
//   (each { pointRefs: [{x, y, offsetTop}], ... }).
// `config` is one wall config:
//   { profileType: "STRAIGHT"|"CONSTANT"|"MAX", height, maxHeight,
//     annotationTemplateId, template }
export default function useGenerateWallsFromSegments() {
  const createAnnotation = useCreateAnnotation();
  const createEntity = useCreateEntity();
  const baseMap = useMainBaseMap();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  return async (annotation, chains, config) => {
    if (!annotation || !Array.isArray(chains) || chains.length === 0) return [];
    if (!config) return [];

    const imageSize = baseMap?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) {
      console.warn("[useGenerateWallsFromSegments] missing baseMap imageSize");
      return [];
    }

    const created = [];

    for (const chain of chains) {
      const wallPts = buildWallPolylineFromChain({
        pointRefs: chain?.pointRefs,
        profileType: config.profileType,
        height: config.height,
        maxHeight: config.maxHeight,
      });

      if (!wallPts || wallPts.length < 2) {
        console.warn(
          "[useGenerateWallsFromSegments] no wall geometry for chain",
          chain
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

      // 2. Owning entity (mirrors useGenerateSlopeWalls).
      const entity = await createEntity({
        listingId: config.template?.listingId || annotation.listingId,
        projectId: annotation.projectId,
      });

      // 3. The POLYLINE wall annotation.
      const newAnnotation = {
        ...getAnnotationTemplateProps(config.template),
        id: nanoid(),
        entityId: entity?.id,
        projectId: annotation.projectId,
        listingId: config.template?.listingId || annotation.listingId,
        baseMapId: annotation.baseMapId,
        type: "POLYLINE",
        closeLine: false,
        points: pointRefs,
        cuts: [],
        offsetZ: 0,
        height: 0,
        annotationTemplateId: config.annotationTemplateId,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      };

      const _annotation = await createAnnotation(newAnnotation);
      if (_annotation) created.push(_annotation);
    }

    return created;
  };
}
