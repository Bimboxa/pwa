import { useState, useEffect } from "react"

import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";

export default function usePdfPageImageUrl(pdf, pageNumber, rotate) {

    const [imageUrl, setImageUrl] = useState(null);

    useEffect(() => {
        let objectUrl = null;
        if (pdf) {
            pdfToPngAsync({ pdfFile: pdf, page: pageNumber, rotate }).then((file) => {
                objectUrl = URL.createObjectURL(file);
                setImageUrl(objectUrl);
            });
        }
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setImageUrl(null);
        };
    }, [pdf, pageNumber, rotate]);

    return imageUrl;
}