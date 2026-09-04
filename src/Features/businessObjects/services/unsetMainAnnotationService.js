import db from "App/db/db";

// "Retirer la localisation": the annotation stays linked to the object as a
// plain link, it just stops being its main annotation (its label no longer
// follows the object's name).
export default async function unsetMainAnnotationService({ rel }) {
  if (!rel?.id) return;
  await db.relsBusinessObjectAnnotation.update(rel.id, { isMain: false });
}
