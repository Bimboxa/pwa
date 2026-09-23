import db from "App/db/db";
import { buildBaseMapContext } from "Features/assistantRelay/services/publishBaseMapSnapshotService";
import {
  fetchBaseMapJob,
  uploadRelayPdf,
} from "Features/assistantRelay/services/assistantRelayClient";

import { describeAiTaskSource } from "../utils/aiTaskSource";

export default async function resolveAiTaskSource({
  baseMap,
  projectId,
  scopeId,
  listingId,
  config,
}) {
  const source = describeAiTaskSource(baseMap);
  const cf = baseMap.createdFrom;
  const relay = cf.relay;
  const sameRelay =
    !relay?.relayBaseUrl ||
    relay.relayBaseUrl.replace(/\/+$/, "") ===
      config?.relayBaseUrl?.replace(/\/+$/, "");
  let pdfId = sameRelay ? relay?.sourcePdfId : null;
  let pdfByteSize = null;
  if (pdfId && relay?.baseMapJobId) {
    const job = await fetchBaseMapJob(relay.baseMapJobId);
    pdfByteSize = job.pdf?.byteSize ?? null;
  }
  if (!pdfId) {
    const resource = cf.resourceId
      ? await db.resources.get(cf.resourceId)
      : null;
    if (!resource || resource.deletedAt || resource.projectId !== projectId)
      throw new Error(
        "Le PDF source est introuvable dans les ressources du projet."
      );
    const file = await db.files.get(resource.fileName);
    if (!file?.fileArrayBuffer)
      throw new Error(
        "Le PDF source n’est pas téléchargé. Ouvrez-le dans les ressources avant de réessayer."
      );
    const uploaded = await uploadRelayPdf(
      new File([file.fileArrayBuffer], source.fileName, {
        type: "application/pdf",
      })
    );
    pdfId = uploaded.pdfId;
    pdfByteSize = uploaded.byteSize;
  }
  return {
    pdfId,
    pdfByteSize,
    pageNumber: source.frame.pageNumber,
    existingBaseMap: {
      context: {
        ...buildBaseMapContext({
          baseMap,
          projectId,
          scopeId,
          listingId,
          config,
        }),
        sourcePdfId: pdfId,
        sourceFrame: source.frame,
      },
      sourceImageSize: source.sourceImageSize,
      transform: source.transform,
    },
  };
}
