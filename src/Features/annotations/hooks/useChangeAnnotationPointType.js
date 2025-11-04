import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

export default function useChangeAnnotationPointType() {
  // data

  const dispatch = useDispatch();

  // return

  return async (annotationId, pointIndex) => {
    const annotation = await db.annotations.get(annotationId);
    if (!annotation) return;
    const points = annotation.points.map((point, index) => {
      if (index === pointIndex) {
        return {
          ...point,
          type: point.type === "circle" ? "square" : "circle",
        };
      }
      return point;
    });
    await db.annotations.update(annotationId, { points });

    dispatch(triggerAnnotationsUpdate());
  };
}
