import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import { getDocument } from "pdfjs-dist";

import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default async function pdfToPngAsync({
  pdfFile,
  page = 1,
  bboxInRatio, // { x1, y1, x2, y2 } en pourcentage (0-100)
  resolution = 72 // Résolution cible en DPI (ex: 72, 150, 300)
}) {
  // Création d'un URL pour charger le fichier PDF
  const pdfUrl = URL.createObjectURL(pdfFile);

  try {
    // Chargement du document PDF
    const loadingTask = getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    // Sélection de la page
    const pdfPage = await pdf.getPage(page);

    // 1. Calcul du Scale basé sur le DPI (Le standard PDF est 72 DPI)
    const scale = resolution / 72;
    const viewport = pdfPage.getViewport({ scale });

    // Création du canvas
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // 2. Gestion du Bounding Box (si fourni)
    let offsetX = 0;
    let offsetY = 0;

    if (bboxInRatio) {
      const { x1, y1, x2, y2 } = bboxInRatio;

      // Calcul des dimensions en pixels réels basés sur le viewport
      const rawWidth = viewport.width;
      const rawHeight = viewport.height;

      const cropX = (x1) * rawWidth;
      const cropY = (y1) * rawHeight;
      const cropWidth = ((x2 - x1)) * rawWidth;
      const cropHeight = ((y2 - y1)) * rawHeight;

      // On dimensionne le canvas à la taille de la coupe (crop)
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // On prépare le décalage pour le rendu
      offsetX = -cropX;
      offsetY = -cropY;
    } else {
      // Pas de bbox : on prend toute la page
      canvas.width = viewport.width;
      canvas.height = viewport.height;
    }

    // 3. Application de la translation (Crop)
    // On déplace le point d'origine du contexte. 
    // PDFJS dessinera toute la page, mais seule la partie visible dans le canvas sera conservée.
    if (offsetX !== 0 || offsetY !== 0) {
      context.translate(offsetX, offsetY);
    }

    // Rendu de la page dans le canvas
    // Note : On passe toujours le viewport complet, c'est le 'translate' ci-dessus qui fait le cadrage.
    await pdfPage.render({ canvasContext: context, viewport }).promise;

    // Conversion en Data URL (PNG)
    const pngDataUrl = canvas.toDataURL("image/png");

    // Nom de l'image
    const pdfFileName = pdfFile.name.replace(".pdf", "");
    // On ajoute un suffixe si c'est un crop pour différencier
    const suffix = bboxInRatio ? "_crop" : "";
    const name = `${pdfFileName}_page${page}${suffix}.png`;

    const pngFile = await imageUrlToPng({ url: pngDataUrl, name });

    console.log("[pdfToPng]", pngFile);

    // Nettoyage
    URL.revokeObjectURL(pdfUrl);

    return pngFile;
  } catch (error) {
    console.error("Erreur lors de la conversion du PDF :", error);
    throw error;
  }
}