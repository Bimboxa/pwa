import db from "App/db/db";
import { generateKeyBetween } from "fractional-indexing";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";
import { templateType, toAiTaskContract } from "../utils/aiTaskMappings";

// Atomic and stable per launch: an uncertain network response can be retried
// without making another list or another copy of a template.
export default async function prepareAiTaskDestination({
  requestId,
  listingId,
  newListingName,
  projectId,
  scopeId,
  rows,
  appConfig,
}) {
  return db.transaction("rw", db.listings, db.annotationTemplates, async () => {
    const destinationId = listingId === "new" ? `${requestId}:list` : listingId;
    let listing = await db.listings.get(destinationId);
    if (!listing && listingId === "new") {
      const entityModel = getDefaultLocatedEntityModel(appConfig);
      if (!entityModel || !scopeId || !newListingName?.trim())
        throw new Error("Renseignez une liste et sélectionnez un repérage.");
      listing = {
        id: destinationId,
        name: newListingName.trim(),
        projectId,
        scopeId,
        canCreateItem: true,
        entityModel,
        entityModelKey: entityModel.key,
        table: entityModel.defaultTable ?? "entities",
        aiTaskRequestId: requestId,
      };
      await db.listings.add(listing);
    }
    if (
      !listing ||
      listing.deletedAt ||
      listing.projectId !== projectId ||
      listing.scopeId !== scopeId ||
      (
        listing.entityModel ??
        appConfig?.entityModelsObject?.[listing.entityModelKey]
      )?.type !== "LOCATED_ENTITY"
    )
      throw new Error("La liste cible n’est plus disponible dans ce repérage.");
    const contracts = [],
      resolved = [];
    let orderIndex =
      (
        await db.annotationTemplates
          .where("listingId")
          .equals(destinationId)
          .toArray()
      )
        .filter((t) => !t.deletedAt && t.orderIndex)
        .map((t) => t.orderIndex)
        .sort()
        .at(-1) ?? null;
    for (const row of rows) {
      const source =
        row.templateId === "new"
          ? row
          : await db.annotationTemplates.get(row.templateId);
      if (
        !source ||
        source.deletedAt ||
        (row.templateId !== "new" && source.projectId !== projectId) ||
        !["STRIP", "POLYLINE"].includes(templateType(source))
      )
        throw new Error(
          `Choisissez un modèle valide pour ${row.detectionLabel}.`
        );
      let template = source;
      if (row.templateId === "new" || source.listingId !== destinationId) {
        const id = `${requestId}:${row.templateId === "new" ? row.id : source.id}`;
        template = await db.annotationTemplates.get(id);
        if (!template) {
          orderIndex = generateKeyBetween(orderIndex, null);
          template = {
            ...getAnnotationTemplateProps(source),
            id,
            label: source.label,
            type: templateType(source),
            drawingShape: templateType(source),
            projectId,
            listingId: destinationId,
            orderIndex,
            aiTaskRequestId: requestId,
          };
          template.code = getAnnotationTemplateCode({
            annotation: template,
            listingKey: destinationId,
          });
          await db.annotationTemplates.add(template);
        }
        if (template.deletedAt)
          throw new Error("Un modèle créé pour cette tâche a été supprimé.");
      }
      const contract = toAiTaskContract(row, template);
      contracts.push({ ...contract, existingTemplateId: template.id });
      resolved.push(template);
    }
    return {
      listing,
      contracts,
      templates: [...new Map(resolved.map((t) => [t.id, t])).values()],
    };
  });
}
