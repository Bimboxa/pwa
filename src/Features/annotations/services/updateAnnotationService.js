import db from "App/db/db";

export default async function updateAnnotationService(annotation) {
  await db.annotations.update(annotation.id, { ...annotation }); // partial update
}
