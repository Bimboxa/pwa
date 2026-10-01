import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import createBusinessObjectListingService from "Features/businessObjects/services/createBusinessObjectListingService";
import createIssuesFromPromptIaService, {
  ISSUES_LISTING_NAME,
} from "Features/businessObjects/services/createIssuesFromPromptIaService";
import findTextInPdfDocumentService from "Features/resources/services/findTextInPdfDocumentService";
import getAnnotationsWithQtiesService from "./getAnnotationsWithQtiesService";

import buildPromptIaBusinessObjectRows from "Features/businessObjects/utils/buildPromptIaBusinessObjectRows";
import buildQtyGapIssues from "Features/businessObjects/utils/buildQtyGapIssues";
import computeBusinessObjectQties from "Features/businessObjects/utils/computeBusinessObjectQties";

export { ISSUES_LISTING_NAME };

const getName = ({ code, label }) => [code, label].filter(Boolean).join(" ");

/**
 * Business side of a scope created by the Prompt IA: the business-object
 * listings of the json (DPGF…) with their links to the annotations and to
 * the documents (titles of the CCTP), then the issues — the ones the model
 * reported and the quantity gaps (> 5 % between the quantity computed from
 * the linked annotations and the reference one) — in ONE listing of type
 * ISSUE, each issue linked to its annotations and documents.
 *
 * Hook-free. The scope must be the selected one (db guards). The caller
 * dispatches the redux ticks.
 *
 * @param {Object} params
 * @param {Object} params.scope - parsed scope (parsePromptIaProjectOutput)
 * @param {string} params.projectId
 * @param {Object} params.appConfig
 * @param {Map<string, Object>} params.placedAnnotationById - parsed
 *   annotation id → annotation row written to the database
 * @param {Map<string, Object>} params.baseMapById - base map records
 * @param {Map<string, {resource: Object, getPdfDocument: Function, pagesCache: Map}>} params.documentById
 * @param {string[]} params.errors - messages for the user
 * @returns {Promise<{listings: number, businessObjects: number,
 *   issues: number, qtyGapIssues: number, annotationLinks: number,
 *   documentLinks: number}>}
 */
export default async function createScopeBusinessObjectsFromPromptIaService({
  scope,
  projectId,
  appConfig,
  placedAnnotationById,
  baseMapById,
  documentById,
  errors,
}) {
  const counts = {
    listings: 0,
    businessObjects: 0,
    issues: 0,
    qtyGapIssues: 0,
    annotationLinks: 0,
    documentLinks: 0,
  };
  const annotationRels = [];
  const resourceRels = [];
  let unlocatedTitles = 0;

  // helpers

  const getBase = (businessObject) => ({
    projectId: businessObject.projectId,
    scopeId: businessObject.scopeId,
    listingId: businessObject.listingId,
    businessObjectId: businessObject.id,
  });

  // `annotationIds`: parsed ids, or db ids with `placed: true`
  function linkAnnotations(businessObject, annotationIds, { placed } = {}) {
    const ids = new Set();
    for (const id of annotationIds ?? []) {
      const annotationId = placed ? id : placedAnnotationById.get(id)?.id;
      if (annotationId) ids.add(annotationId);
    }
    for (const annotationId of ids)
      annotationRels.push({
        id: nanoid(),
        ...getBase(businessObject),
        annotationId,
      });
  }

  async function linkDocuments(businessObject, documentLinks) {
    const wholeLinked = new Set();
    for (const link of documentLinks ?? []) {
      const document = documentById.get(link.documentId);
      if (!document) continue; // its resource failed, already reported
      const { resource } = document;

      let found = null;
      if (link.title) {
        try {
          found = await findTextInPdfDocumentService({
            pdfDocument: await document.getPdfDocument(),
            text: link.title,
            pageNumber: link.pageNumber,
            pagesCache: document.pagesCache,
          });
        } catch (e) {
          console.warn("[promptIaProject] title lookup failed", e);
        }
        if (!found) unlocatedTitles += 1;
      }
      // title not found (or no title): the whole document, once per object
      if (!found && wholeLinked.has(resource.id)) continue;
      if (!found) wholeLinked.add(resource.id);

      resourceRels.push({
        id: nanoid(),
        ...getBase(businessObject),
        resourceId: resource.id,
        resourceName: resource.name,
        pageNumber: found?.pageNumber ?? null,
        rects: found?.rects ?? [],
        text: found?.text ?? link.title ?? "",
      });
    }
  }

  // business-object listings

  const createdObjects = [];
  for (const parsedListing of scope.businessObjectListings ?? []) {
    try {
      const listing = await createBusinessObjectListingService({
        projectId,
        scopeId: scope.id,
        name: parsedListing.name,
        typeKey: parsedListing.type,
        appConfig,
      });
      const rows = buildPromptIaBusinessObjectRows({
        listing,
        items: parsedListing.items,
        newId: nanoid,
      });
      await db.businessObjects.bulkAdd(rows);
      counts.listings += 1;
      counts.businessObjects += rows.length;

      const rowById = new Map(rows.map((row) => [row.id, row]));
      for (const item of parsedListing.items) {
        const row = rowById.get(item.id);
        if (!row) continue;
        linkAnnotations(row, item.annotationIds);
        await linkDocuments(row, item.documentLinks);
      }
      createdObjects.push(...rows);
    } catch (e) {
      console.error("[promptIaProject] business objects failed", e);
      errors.push(
        `Liste « ${parsedListing.name} » (${scope.name}) : ${e?.message ?? String(e)}`
      );
    }
  }

  // quantity gaps, from the links just built (not written yet)

  let qtyGapIssues = [];
  try {
    const linkedIds = new Set(annotationRels.map((rel) => rel.annotationId));
    const annotations = await getAnnotationsWithQtiesService({
      annotations: [...placedAnnotationById.values()].filter((a) =>
        linkedIds.has(a.id)
      ),
      baseMapById,
    });
    const unscaled = annotations.filter((a) => !a.qties).length;
    if (unscaled > 0)
      errors.push(
        `Scope « ${scope.name} » : ${unscaled} annotation(s) liée(s) sur un fond sans échelle, quantités non contrôlées.`
      );
    qtyGapIssues = buildQtyGapIssues({
      businessObjects: createdObjects,
      ...computeBusinessObjectQties({
        rels: annotationRels,
        annotations: annotations.filter((a) => a.qties),
        businessObjects: createdObjects,
      }),
    });
  } catch (e) {
    console.error("[promptIaProject] quantity control failed", e);
    errors.push(
      `Contrôle des quantités (${scope.name}) : ${e?.message ?? String(e)}`
    );
  }

  // issues

  const objectById = new Map(createdObjects.map((row) => [row.id, row]));
  const issueItems = [
    ...(scope.issues ?? []).map((issue, index) => {
      const objects = issue.businessObjects
        .map((o) => objectById.get(o.id))
        .filter(Boolean);
      const objectsS = objects.length
        ? `Ouvrage(s) concerné(s) : ${objects.map(getName).join(" ; ")}`
        : null;
      return {
        ref: `issue_${index}`,
        parentRef: null,
        label: issue.label,
        description:
          [issue.description, objectsS].filter(Boolean).join("\n\n") || null,
        annotationIds: issue.annotationIds,
        documentLinks: issue.documentLinks,
      };
    }),
    ...qtyGapIssues.map((issue, index) => ({
      ref: `qty_gap_${index}`,
      parentRef: null,
      label: issue.label,
      description: issue.description,
      placedAnnotationIds: issue.annotationIds,
    })),
  ].map((item) => ({ ...item, id: nanoid() }));

  if (issueItems.length) {
    try {
      const { rows } = await createIssuesFromPromptIaService({
        projectId,
        scopeId: scope.id,
        appConfig,
        items: issueItems,
      });
      counts.issues = rows.length;
      counts.qtyGapIssues = qtyGapIssues.length;

      const rowById = new Map(rows.map((row) => [row.id, row]));
      for (const item of issueItems) {
        const row = rowById.get(item.id);
        linkAnnotations(row, item.annotationIds);
        linkAnnotations(row, item.placedAnnotationIds, { placed: true });
        await linkDocuments(row, item.documentLinks);
      }
    } catch (e) {
      console.error("[promptIaProject] issues failed", e);
      errors.push(
        `Points d'attention (${scope.name}) : ${e?.message ?? String(e)}`
      );
    }
  }

  // relations, in one transaction

  await db.transaction(
    "rw",
    db.relsBusinessObjectAnnotation,
    db.relsBusinessObjectResource,
    async () => {
      if (annotationRels.length)
        await db.relsBusinessObjectAnnotation.bulkAdd(annotationRels);
      if (resourceRels.length)
        await db.relsBusinessObjectResource.bulkAdd(resourceRels);
    }
  );
  counts.annotationLinks = annotationRels.length;
  counts.documentLinks = resourceRels.length;

  if (unlocatedTitles > 0)
    errors.push(
      `Scope « ${scope.name} » : ${unlocatedTitles} titre(s) introuvable(s) dans les documents, lien posé sur le document entier.`
    );

  return counts;
}
