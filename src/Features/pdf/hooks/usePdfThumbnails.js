import { useState, useEffect } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

// Petit utilitaire pour transformer le callback toBlob en Promise
const canvasToBlob = (canvas) => {
    return new Promise((resolve) => {
        // 'image/jpeg' est plus rapide à encoder que png
        // 0.7 est un bon compromis qualité/vitesse pour des miniatures
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
    });
};

export default function usePdfThumbnails(pdfFile) {
    const [thumbnails, setThumbnails] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!pdfFile) {
            setThumbnails([]);
            return;
        }

        let isCancelled = false;
        // On garde une trace locale des URLs créées pour le nettoyage mémoire
        const generatedUrls = [];
        const pdfUrl = URL.createObjectURL(pdfFile);

        const generateThumbnails = async () => {
            try {
                setError(null);
                const loadingTask = getDocument(pdfUrl);
                const pdfDoc = await loadingTask.promise;

                if (isCancelled) return;

                const numPages = pdfDoc.numPages;

                // Initialisation des placeholders
                setThumbnails(Array.from({ length: numPages }, (_, index) => ({
                    pageNumber: index + 1,
                    status: "pending",
                    imageUrl: null,
                })));

                for (let i = 1; i <= numPages; i++) {
                    if (isCancelled) break;

                    // Pause respiration pour l'UI
                    await yieldToMain();

                    try {
                        const page = await pdfDoc.getPage(i);

                        // Calcul du scale
                        const desiredWidth = 200;
                        const viewportRaw = page.getViewport({ scale: 1 });
                        const scale = desiredWidth / viewportRaw.width;
                        const viewport = page.getViewport({ scale });

                        const canvas = document.createElement("canvas");
                        const context = canvas.getContext("2d", {
                            willReadFrequently: true,
                            alpha: false
                        });

                        canvas.width = viewport.width;
                        canvas.height = viewport.height;

                        // Rendu graphique (Lourd)
                        await page.render({ canvasContext: context, viewport }).promise;

                        // Encodage image (Asynchrone via Blob)
                        const blob = await canvasToBlob(canvas);

                        if (blob && !isCancelled) {
                            const blobUrl = URL.createObjectURL(blob);
                            generatedUrls.push(blobUrl); // On note l'URL pour la nettoyer plus tard

                            setThumbnails((prev) => {
                                const newArr = [...prev];
                                if (newArr[i - 1]) {
                                    newArr[i - 1] = {
                                        pageNumber: i,
                                        status: "success",
                                        imageUrl: blobUrl,
                                    };
                                }
                                return newArr;
                            });
                        }

                        // Nettoyage immédiat de la page PDF pour libérer la mémoire de pdf.js
                        page.cleanup();

                    } catch (pageError) {
                        console.error(`Erreur page ${i}`, pageError);
                        if (!isCancelled) {
                            setThumbnails((prev) => {
                                const newArr = [...prev];
                                if (newArr[i - 1]) {
                                    newArr[i - 1] = { ...newArr[i - 1], status: "error" };
                                }
                                return newArr;
                            });
                        }
                    }
                }

            } catch (err) {
                console.error("Erreur globale", err);
                if (!isCancelled) setError(err);
            } finally {
                // On ne révoque PAS les generatedUrls ici, car on en a besoin pour l'affichage !
                // On révoque seulement l'URL du fichier source PDF
                if (!isCancelled) URL.revokeObjectURL(pdfUrl);
            }
        };

        generateThumbnails();

        // CLEANUP FUNCTION (Important avec les blobs)
        return () => {
            isCancelled = true;
            URL.revokeObjectURL(pdfUrl);
            // On libère la mémoire de toutes les miniatures créées
            generatedUrls.forEach(url => URL.revokeObjectURL(url));
        };

    }, [pdfFile]);

    return { thumbnails, error };
}