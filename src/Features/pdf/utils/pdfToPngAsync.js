import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default async function pdfToPngAsync({
  pdfFile,
  page = 1,
  bboxInRatio,
  resolution = 72,
  rotate = 0,
  blueprintScale = null // Par défaut null
}) {
  const pdfUrl = URL.createObjectURL(pdfFile);

  try {
    const loadingTask = getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const pdfPage = await pdf.getPage(page);

    // 1. Calcul du Scale basé sur la résolution demandée
    // PDF.js utilise 72 DPI par défaut comme échelle 1.
    const scale = resolution / 72;
    const viewport = pdfPage.getViewport({ scale, rotation: rotate });

    // Création du canvas
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    // 2. Gestion du Bounding Box
    let offsetX = 0;
    let offsetY = 0;

    if (bboxInRatio) {
      const { x1, y1, x2, y2 } = bboxInRatio;
      const rawWidth = viewport.width;
      const rawHeight = viewport.height;

      const cropX = (x1) * rawWidth;
      const cropY = (y1) * rawHeight;
      const cropWidth = ((x2 - x1)) * rawWidth;
      const cropHeight = ((y2 - y1)) * rawHeight;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      offsetX = -cropX;
      offsetY = -cropY;
    } else {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
    }

    // 3. Application de la translation
    if (offsetX !== 0 || offsetY !== 0) {
      context.translate(offsetX, offsetY);
    }

    // Rendu
    await pdfPage.render({ canvasContext: context, viewport }).promise;

    const pngDataUrl = canvas.toDataURL("image/png");
    const pdfFileName = pdfFile.name.replace(".pdf", "");
    const suffix = bboxInRatio ? "_crop" : "";
    const rotSuffix = rotate > 0 ? `_r${rotate}` : "";
    const name = `${pdfFileName}_page${page}${rotSuffix}${suffix}.png`;

    const pngFile = await imageUrlToPng({ url: pngDataUrl, name });

    // --- CALCUL DE METER BY PX ---
    let meterByPx = null;
    if (blueprintScale) {
      const _blueprintScale = Number(blueprintScale);
      // 1 pouce = 0.0254 mètres
      // resolution = pixels par pouce (DPI)
      // Taille d'un pixel sur le "papier" en mètres = 0.0254 / resolution
      // Taille réelle = Taille papier * échelle
      meterByPx = (0.0254 / resolution) * _blueprintScale;
    }

    console.log("[pdfToPng]", { pngFile, meterByPx });

    URL.revokeObjectURL(pdfUrl);

    return { imageFile: pngFile, meterByPx };

  } catch (error) {
    console.error("Erreur lors de la conversion du PDF :", error);
    // Important : toujours nettoyer l'URL même en cas d'erreur pour éviter les fuites mémoire
    URL.revokeObjectURL(pdfUrl);
    throw error;
  }
}