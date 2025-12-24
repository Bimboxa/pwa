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
export default async function generateThumbnailsAsync({ pdfFile, scale = 0.3 }) {
    const pdfUrl = URL.createObjectURL(pdfFile);

    try {
        const loadingTask = getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        const thumbnails = [];

        for (let i = 1; i <= numPages; i++) {
            const pdfPage = await pdf.getPage(i);
            const viewport = pdfPage.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await pdfPage.render({ canvasContext: context, viewport }).promise;

            const pngDataUrl = canvas.toDataURL("image/png");
            thumbnails.push(pngDataUrl);
        }

        URL.revokeObjectURL(pdfUrl);
        return thumbnails;
    } catch (error) {
        console.error("Error generating thumbnails:", error);
        URL.revokeObjectURL(pdfUrl);
        throw error;
    }
}