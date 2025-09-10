import db from "App/db/db";

export default async function createAnnotationService(annotation) {
  await db.annotations.put(annotation);
}
