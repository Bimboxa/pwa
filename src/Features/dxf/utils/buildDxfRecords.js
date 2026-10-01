import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";
import { dxfPointToPixel } from "./dxfFrame.js";

// All geometry uses the same immutable frame as the preview and raster.
export default function buildDxfRecords({
  drawing,
  frame,
  baseMapId,
  listingId,
  projectId,
  scopeId,
  layersMode,
  hiddenLayers,
  pagePxPerPt = 1,
}) {
  let previousOrder = null;
  const layers = drawing.layers.map((layer) => {
    const orderIndex = generateKeyBetween(previousOrder, null);
    previousOrder = orderIndex;
    return {
      id: nanoid(),
      projectId,
      scopeId,
      ...(layersMode === "GLOBAL" ? {} : { baseMapId }),
      name: layer.name,
      orderIndex,
      dxfBaseMapId: baseMapId,
      dxfLayerName: layer.name,
      dxfInitiallyHidden: hiddenLayers.has(layer.name),
    };
  });
  const layerByName = new Map(layers.map((layer) => [layer.name, layer]));
  const points = [];
  const pointIds = new Map();
  const normalize = (p) => {
    const pixel = dxfPointToPixel(p, frame);
    return { x: pixel.x / frame.width, y: pixel.y / frame.height };
  };
  const pointRefs = (ring) =>
    ring.map((p) => {
      const pixel = dxfPointToPixel(p, frame);
      const x = pixel.x / frame.width,
        y = pixel.y / frame.height;
      // Exact coincident endpoints share an id only within this import.
      const key = `${x},${y}`;
      if (!pointIds.has(key)) {
        const id = nanoid();
        pointIds.set(key, id);
        points.push({ id, x, y, projectId, listingId, baseMapId });
      }
      return { id: pointIds.get(key) };
    });
  const annotations = drawing.objects.map((object) => {
    const common = {
      id: nanoid(),
      projectId,
      listingId,
      baseMapId,
      layerId: layerByName.get(object.layer).id,
      dxfHandle: object.handle,
      dxfEntityType: object.sourceType,
      ...(object.dimensionHandle && {
        dxfDimensionHandle: object.dimensionHandle,
      }),
      fromDXF: true,
    };
    if (object.kind === "TEXT") {
      // FREE_TEXT uses inline normalized label/target points, unlike polygon
      // vertices which belong in db.points. Its sizes are in page points.
      const anchor = normalize(object.center);
      return {
        ...common,
        type: "FREE_TEXT",
        textContent: object.text,
        labelPoint: anchor,
        targetPoint: { ...anchor },
        fontFamily: "Arial",
        fontSize: (object.textHeight * frame.scale) / pagePxPerPt,
        width: (object.textWidth * frame.scale) / pagePxPerPt + 2,
        minWidth: 0,
        rotation: (-object.rotation * 180) / Math.PI,
        textAlign: object.textAlign,
        textColor: object.color,
        hasBackground: false,
        hasBorder: false,
        hasPadding: false,
        hasConnector: false,
        pageFormat: "A3",
      };
    }
    const polygon = object.kind === "POLYGON";
    return {
      ...common,
      type: polygon ? "POLYGON" : "POLYLINE",
      points: pointRefs(object.points),
      ...(polygon && {
        cuts: (object.holes ?? []).map((ring) => ({ points: pointRefs(ring) })),
        fillColor: object.color,
        fillType: object.fillType ?? "SOLID",
        dxfPatternName: object.patternName,
      }),
      closeLine: object.closed,
      strokeColor: object.color,
      strokeWidth: 1,
      strokeWidthUnit: "PX",
      strokeType: "SOLID",
      strokeOpacity: 1,
      fillOpacity: polygon ? 1 : 0,
      showLabel: false,
    };
  });
  return { layers, points, annotations };
}
