import { ListItemButton, Typography } from "@mui/material";

import downloadBlob from "Features/files/utils/downloadBlob";
import addBackgroundToImage from "Features/images/utils/addBackgroundToImage";

export default function ButtonDownloadBaseMap({ baseMap }) {

    // strings

    const downloadS = "Télécharger l'image";

    // handlers

    async function handleDownload() {
        const imageUrl = baseMap.getUrl();
        const bgColor = "#FFFFFF";
        const processedImageFile = await addBackgroundToImage(imageUrl, bgColor)
        if (processedImageFile) downloadBlob(processedImageFile, baseMap.name);
    }

    return <ListItemButton onClick={handleDownload} divider>
        <Typography variant="body2">{downloadS}</Typography>
    </ListItemButton>
}