import { useSelector } from "react-redux";

import useAnnotations from "Features/annotations/hooks/useAnnotations";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useOrgaLogoUrl from "Features/orgaData/hooks/useOrgaLogoUrl";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import mergePdfs from "Features/pdf/utils/mergePdfs";
import downloadBlob from "Features/files/utils/downloadBlob";

import createAnnotationsPdfReport from "Features/pdfReport/utils/createAnnotationsPdfReport";

export default function useDownladPdfReport() {
  // data

  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const mainBaseMap = useMainBaseMap();
  const spriteImage = useAnnotationSpriteImage();
  const orgaLogoUrl = useOrgaLogoUrl();

  const annotations = useAnnotations({
    addDemoAnnotations: false,
    filterByBaseMapId: mainBaseMap?.id,
    excludeListingsIds: hiddenListingsIds,
    withEntity: true,
    withLabel: true,
  });

  // handlers

  async function exportPdf({ svgElement, name, addTable }) {
    console.log("click");
    const blob = await getImageFromSvg(svgElement);
    const url = URL.createObjectURL(blob);
    const blueprintPdf = await imageToPdfAsync({ url });

    let finalPdf;

    if (addTable) {
      console.log("[DownloadPdfReport]annotations", annotations);
      const issuesPdf = await createAnnotationsPdfReport(annotations, {
        spriteImage,
        logoImage: { url: orgaLogoUrl },
        title: "Rapport photos",
      });
      finalPdf = await mergePdfs([blueprintPdf, issuesPdf], {
        addPageNumber: true,
      });
    } else {
      // If no table is requested, just use the blueprint PDF
      finalPdf = blueprintPdf;
    }

    downloadBlob(finalPdf, name);
  }

  // return

  return exportPdf;
}
