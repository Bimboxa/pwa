import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Generates an array of data URLs (PNG) for all pages of a PDF file.
 * 
 * @param {Object} params
 * @param {File} params.pdfFile - The PDF file to process
 * @param {number} [params.scale=0.3] - Scale for thumbnails
 * @returns {Promise<string[]>} Array of data URLs
 */
export default async function generatePageThumbnailAsync({ pdfFile, scale = 0.1, pageNumber }) {
    const pdfUrl = URL.createObjectURL(pdfFile);

    try {
        const loadingTask = getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        const pdfPage = await pdf.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({ canvasContext: context, viewport }).promise;

        const pngDataUrl = canvas.toDataURL("image/png");

        URL.revokeObjectURL(pdfUrl);
        return pngDataUrl;
    } catch (error) {
        console.error("Error generating thumbnails:", error);
        URL.revokeObjectURL(pdfUrl);
        throw error;
    }
}