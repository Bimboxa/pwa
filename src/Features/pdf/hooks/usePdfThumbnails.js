import { useState, useEffect, useRef } from "react";

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

const canvasToBlob = (canvas) => {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
    });
};

export default function usePdfThumbnails(pdfDocument, priorityPage = 1) {
    const [thumbnails, setThumbnails] = useState([]);
    const [error, setError] = useState(null);

    // ref kept in sync with priorityPage so the in-flight loop can react to
    // user page changes without restarting from scratch
    const priorityPageRef = useRef(priorityPage);
    useEffect(() => {
        priorityPageRef.current = priorityPage;
    }, [priorityPage]);

    useEffect(() => {
        if (!pdfDocument) {
            setThumbnails([]);
            return;
        }

        let isCancelled = false;
        const generatedUrls = [];

        const generateThumbnails = async () => {
            try {
                setError(null);

                const numPages = pdfDocument.numPages;

                setThumbnails(Array.from({ length: numPages }, (_, index) => ({
                    pageNumber: index + 1,
                    status: "pending",
                    imageUrl: null,
                })));

                // Pages still to render. We pick from this set, preferring the
                // current priorityPage (which can change as user navigates).
                const remaining = new Set();
                for (let i = 1; i <= numPages; i++) remaining.add(i);

                while (remaining.size > 0) {
                    if (isCancelled) break;

                    const prio = priorityPageRef.current;
                    let pageIndex;
                    if (remaining.has(prio)) {
                        pageIndex = prio;
                    } else {
                        pageIndex = Math.min(...remaining);
                    }
                    remaining.delete(pageIndex);

                    await yieldToMain();
                    if (isCancelled) break;

                    try {
                        const page = await pdfDocument.getPage(pageIndex);

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

                        await page.render({ canvasContext: context, viewport }).promise;

                        const blob = await canvasToBlob(canvas);

                        if (blob && !isCancelled) {
                            const blobUrl = URL.createObjectURL(blob);
                            generatedUrls.push(blobUrl);

                            setThumbnails((prev) => {
                                const newArr = [...prev];
                                if (newArr[pageIndex - 1]) {
                                    newArr[pageIndex - 1] = {
                                        pageNumber: pageIndex,
                                        status: "success",
                                        imageUrl: blobUrl,
                                    };
                                }
                                return newArr;
                            });
                        }

                        page.cleanup();

                    } catch (pageError) {
                        if (!isCancelled) {
                            console.error(`Erreur page ${pageIndex}`, pageError);
                            setThumbnails((prev) => {
                                const newArr = [...prev];
                                if (newArr[pageIndex - 1]) {
                                    newArr[pageIndex - 1] = { ...newArr[pageIndex - 1], status: "error" };
                                }
                                return newArr;
                            });
                        }
                    }
                }

            } catch (err) {
                if (!isCancelled) {
                    console.error("Erreur globale", err);
                    setError(err);
                }
            }
        };

        generateThumbnails();

        return () => {
            isCancelled = true;
            generatedUrls.forEach(url => URL.revokeObjectURL(url));
        };

    }, [pdfDocument]);

    return { thumbnails, error };
}
