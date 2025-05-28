import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import {getDocument} from "pdfjs-dist";

import {GlobalWorkerOptions} from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default async function pdfToPngAsync({pdfFile, page = 1, scale = 1}) {
  // Création d'un URL pour charger le fichier PDF
  const pdfUrl = URL.createObjectURL(pdfFile);

  try {
    // Chargement du document PDF
    const loadingTask = getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    // Sélection de la page
    const pdfPage = await pdf.getPage(page);

    // Création d'un canvas temporaire
    const viewport = pdfPage.getViewport({scale}); // plus grand = meilleure résolution
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Rendu de la page dans le canvas
    await pdfPage.render({canvasContext: context, viewport}).promise;

    // Conversion en Data URL (PNG)
    const pngDataUrl = canvas.toDataURL("image/png");

    // Nom de l'image
    const pdfFileName = pdfFile.name.replace(".pdf", "");
    const name = `${pdfFileName}_page${page}.png`;
    const pngFile = await imageUrlToPng({url: pngDataUrl, name});

    console.log("[pdfToPng]", pngFile);

    // Nettoyage
    URL.revokeObjectURL(pdfUrl);

    return pngFile;
  } catch (error) {
    console.error("Erreur lors de la conversion du PDF :", error);
    throw error;
  }
}
