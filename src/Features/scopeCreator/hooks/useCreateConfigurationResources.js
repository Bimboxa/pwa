import { useSelector } from "react-redux";
import { getDocument } from "pdfjs-dist";

import { ensurePdfSourceResource } from "Features/resources/services/ensurePdfPageResourcesService";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";

/*
 * Keep the PDF assets declared by a Krto creation configuration
 * (configuration.resources: [{ assetPath, assetUrl, name }]) as resources of
 * the PROJECT (kind "PDF_SOURCE", visibility "PROJECT"), the same rows the
 * user gets from the Ressources panel with the « Projet » scope.
 * Dedup on the PDF content (ensurePdfSourceResource): a second Krto created
 * in the same project reuses the rows. Called BEFORE the configuration base
 * maps so the PDF_PAGE items of the same PDF point at these rows
 * (ensurePdfPageResources `wholePdf`). Never throws: a failed asset is
 * logged and skipped. Returns the number of resources ensured.
 */
export default function useCreateConfigurationResources() {
  const userProfile = useSelector((s) => s.auth.userProfile);

  return async function createConfigurationResources({
    configuration,
    projectId,
  }) {
    const items = (configuration?.resources ?? []).filter((r) => r?.assetUrl);
    if (!projectId || items.length === 0) return 0;

    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    let count = 0;
    for (const item of items) {
      let pdfDocument = null;
      try {
        const response = await fetch(item.assetUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const fileName =
          item.name ?? item.assetPath?.split("/").pop() ?? "document.pdf";
        const pdfFile = new File([blob], fileName, {
          type: "application/pdf",
        });
        // pdf.js document only for the thumbnail of the row
        try {
          pdfDocument = await getDocument({
            data: await pdfFile.arrayBuffer(),
            ...PDFJS_DOC_PARAMS,
          }).promise;
        } catch (error) {
          console.warn(
            "[createConfigurationResources] PDF not parsed, no thumbnail",
            item.assetPath,
            error
          );
        }
        const resource = await ensurePdfSourceResource({
          pdfFile,
          pdfDocument,
          projectId,
          createdBy,
        });
        if (resource) count += 1;
      } catch (error) {
        console.error(
          "[createConfigurationResources] resource asset not kept",
          item.assetPath,
          error
        );
      } finally {
        pdfDocument?.destroy();
      }
    }
    return count;
  };
}
