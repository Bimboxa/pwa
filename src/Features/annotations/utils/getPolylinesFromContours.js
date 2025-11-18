import { nanoid } from "@reduxjs/toolkit";

export default function getPolylinesFromContours(contours, color, baseMapId) {
  if (!contours || !Array.isArray(contours)) return [];

  const polylines = [];

  contours.forEach((contour) => {
    if (contour.length < 2) return;
    const polyline = {
      id: nanoid(),
      baseMapId,
      type: "POLYLINE",
      points: contour,
      fillColor: color,
      strokeColor: color,
      strokeWidth: 10,
      strokeOpacity: 1,
      strokeType: "SOLID",
      strokeWidthUnit: "PX",
      strokeOffset: 0,
      closeLine: true,
      fillOpacity: 0.8,
    };

    polylines.push(polyline);
  });

  return polylines;
}
