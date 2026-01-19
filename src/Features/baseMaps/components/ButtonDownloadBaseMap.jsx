import { ListItemButton, Typography } from "@mui/material";

import downloadBlob from "Features/files/utils/downloadBlob";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";

import cv from "Features/opencv/services/opencvService";

export default function ButtonDownloadBaseMap({ baseMap }) {

    // strings

    const downloadS = "Télécharger l'image";

    // handlers

    async function handleDownload() {
        const imageUrl = baseMap.getUrl();
        const bgColor = "#FFFFFF";
        await cv.load();
        const { processedImageFile } = await cv.addBackground({ imageUrl, bgColor });
        if (processedImageFile) downloadBlob(processedImageFile, baseMap.name);
    }

    return <ListItemButton onClick={handleDownload} divider>
        <Typography variant="body2">{downloadS}</Typography>
    </ListItemButton>
}