import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
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

  const annotations = useAnnotationsV2({
    addDemoAnnotations: false,
    filterByBaseMapId: mainBaseMap?.id,
    excludeListingsIds: hiddenListingsIds,
    withEntity: true,
    withLabel: true,
  });

  const annotationsWithDetails = annotations.filter(a => a.entity?.description || a.entity?.image)


  // handlers

  async function exportPdf({ svgElement, name, addTable }) {
    console.log("click");
    const blob = await getImageFromSvg(svgElement);
    const url = URL.createObjectURL(blob);
    const blueprintPdf = await imageToPdfAsync({ url });

    let finalPdf;

    if (addTable && annotationsWithDetails.length > 0) {
      console.log("[DownloadPdfReport]annotations", annotations);
      const issuesPdf = await createAnnotationsPdfReport(annotationsWithDetails, {
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
