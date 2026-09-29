import db from "App/db/db";

import createResourcesFromFilesService from "Features/resources/services/createResourcesFromFilesService";
import { MAX_RESOURCE_FILE_BYTES } from "Features/resources/constants/resourceLimits";

import { fetchRelayPdf } from "./assistantRelayClient";

async function hasFile(resource, projectId) {
  if (!resource || resource.deletedAt || resource.projectId !== projectId)
    return false;
  if (!resource.fileName) return false;
  return (
    (await db.files.where("fileName").equals(resource.fileName).count()) > 0
  );
}

/**
 * The local resource holding a PDF stored on the relay (`pdfId`): what a
 * detail baseMap of a live job is rendered from.
 *
 * 1. the chat attachment carrying this pdfId (the usual case: the user
 *    dropped the PDF in this tab);
 * 2. a resource of the project tagged with it (`relayPdfId`, after a reload
 *    or from another session);
 * 3. otherwise the PDF is downloaded from the relay and stored as a resource
 *    of the current scope.
 *
 * @returns {Promise<string|null>} resource id, null when the PDF cannot be had
 */
export default async function resolveRelayPdfResource(
  pdfId,
  { fileName = null, projectId, scopeId = null, createdBy = null, chatState }
) {
  if (!pdfId || !projectId) return null;

  const sessions = Object.values(chatState?.sessions ?? {});
  for (const session of sessions) {
    const attachment = (session.attachments ?? []).find(
      (a) => a.pdfId === pdfId
    );
    if (!attachment) continue;
    const resource = await db.resources.get(attachment.id);
    if (await hasFile(resource, projectId)) return resource.id;
  }

  const tagged = await db.resources
    .where("projectId")
    .equals(projectId)
    .filter((r) => r.relayPdfId === pdfId && !r.deletedAt)
    .toArray();
  for (const resource of tagged) {
    if (await hasFile(resource, projectId)) return resource.id;
  }

  let blob;
  try {
    blob = await fetchRelayPdf(pdfId);
  } catch (e) {
    console.log("[assistantRelay] attachment download failed", pdfId, e);
    return null;
  }
  if (!blob?.size || blob.size > MAX_RESOURCE_FILE_BYTES) return null;
  const name =
    (typeof fileName === "string" && fileName.trim()) ||
    `piece-jointe-${pdfId.slice(0, 8)}.pdf`;
  const [resource] = await createResourcesFromFilesService({
    files: [new File([blob], name, { type: "application/pdf" })],
    projectId,
    scopeId,
    visibility: "SCOPE",
    createdBy,
    props: { relayPdfId: pdfId },
  });
  return resource?.id ?? null;
}
