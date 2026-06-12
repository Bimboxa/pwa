import db from "App/db/db";

// Builds the compact data context appended to each user message so the model
// can reference real template labels and annotation ids.

const MAX_ANNOTATIONS = 50;

export default async function buildPromptContext({
  listingId,
  baseMapId,
  templates,
}) {
  const templatesContext = (templates ?? []).map((t) => ({
    label: t.label,
    type: t.type,
  }));

  let annotations = [];
  if (listingId) {
    annotations = await db.annotations
      .where("listingId")
      .equals(listingId)
      .toArray();
  }
  annotations = annotations.filter(
    (a) => !a.deletedAt && (!baseMapId || a.baseMapId === baseMapId)
  );

  const templateLabelById = Object.fromEntries(
    (templates ?? []).map((t) => [t.id, t.label])
  );

  const total = annotations.length;
  const annotationsContext = annotations.slice(0, MAX_ANNOTATIONS).map((a) => ({
    id: a.id,
    type: a.type,
    ...(a.label ? { label: a.label } : {}),
    ...(a.annotationTemplateId
      ? { templateLabel: templateLabelById[a.annotationTemplateId] }
      : {}),
  }));

  return JSON.stringify({
    annotationTemplates: templatesContext,
    annotations: annotationsContext,
    ...(total > MAX_ANNOTATIONS ? { annotationsTotalCount: total } : {}),
  });
}
