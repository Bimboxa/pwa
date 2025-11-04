import db from "App/db/db";

export default function useDeleteAnnotationPoint() {
  // return

  return async (annotationId, pointIndex) => {
    const annotation = await db.annotations.get(annotationId);
    if (!annotation) return;
    const points = annotation.points.filter((_, index) => index !== pointIndex);
    await db.annotations.update(annotationId, {
      points,
    });
  };
}
