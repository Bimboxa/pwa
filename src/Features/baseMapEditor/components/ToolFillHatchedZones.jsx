import { ListItemButton, Typography } from "@mui/material";

import cv from "Features/opencv/services/opencvService";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

export default function ToolFillHatchedZones() {

    // strings

    const label = "Remplir les hachures 45°";

    // data

    const baseMap = useMainBaseMap();
    const update = useUpdateBaseMapWithImageEnhanced();

    // handlers

    async function handleClick() {
        await cv.load();
        const { processedImageFile } = await cv.fillHatchAsync({
            imageUrl: baseMap.getUrl(),
            fillColor: "#808080",
        });
        if (processedImageFile) {
            await update(baseMap?.id, processedImageFile);
        }
    }

    // render

    return (
        <ListItemButton onClick={handleClick} divider>
            <Typography variant="body2">{label}</Typography>
        </ListItemButton>
    );
}
