import { useState, useEffect, useRef } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

// Configuration du worker (à faire une seule fois idéalement, mais ok ici)
GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function usePdfThumbnails(pdfFile) {
    // State: Tableau d'objets { pageNumber, status, imageUrl }
    const [thumbnails, setThumbnails] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Reset si pas de fichier
        if (!pdfFile) {
            setThumbnails([]);
            return;
        }

        let isCancelled = false;
        const pdfUrl = URL.createObjectURL(pdfFile);

        const generateThumbnails = async () => {
            try {
                setError(null);

                // 1. Chargement du document PDF (une seule fois)
                const loadingTask = getDocument(pdfUrl);
                const pdfDoc = await loadingTask.promise;

                if (isCancelled) return;

                // 2. Initialisation immédiate des placeholders (Status: pending)
                const numPages = pdfDoc.numPages;
                const initialState = Array.from({ length: numPages }, (_, index) => ({
                    pageNumber: index + 1,
                    status: "pending", // 'pending' | 'success' | 'error'
                    imageUrl: null,
                }));

                setThumbnails(initialState);

                // 3. Génération progressive des images
                for (let i = 1; i <= numPages; i++) {
                    if (isCancelled) break;

                    try {
                        const page = await pdfDoc.getPage(i);

                        // Calcul du scale pour une miniature (ex: 150px de large env.)
                        // On peut fixer un scale fixe (ex: 0.2) ou viser une largeur
                        const desiredWidth = 200;
                        const viewportRaw = page.getViewport({ scale: 1 });
                        const scale = desiredWidth / viewportRaw.width;
                        const viewport = page.getViewport({ scale });

                        // Création Canvas
                        const canvas = document.createElement("canvas");
                        const context = canvas.getContext("2d");
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;

                        // Rendu
                        await page.render({ canvasContext: context, viewport }).promise;

                        const imageUrl = canvas.toDataURL("image/png");

                        // Mise à jour de l'état pour CETTE page spécifique
                        setThumbnails((prev) => {
                            const newArr = [...prev];
                            // On trouve l'index correspondant (i-1 car page commence à 1)
                            newArr[i - 1] = {
                                pageNumber: i,
                                status: "success",
                                imageUrl: imageUrl,
                            };
                            return newArr;
                        });

                    } catch (pageError) {
                        console.error(`Erreur page ${i}`, pageError);
                        setThumbnails((prev) => {
                            const newArr = [...prev];
                            newArr[i - 1] = { ...newArr[i - 1], status: "error" };
                            return newArr;
                        });
                    }
                }

            } catch (err) {
                console.error("Erreur globale chargement PDF", err);
                if (!isCancelled) setError(err);
            } finally {
                if (!isCancelled) URL.revokeObjectURL(pdfUrl);
            }
        };

        generateThumbnails();

        // Cleanup function
        return () => {
            isCancelled = true;
            URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfFile?.size]);

    return { thumbnails, error };
}