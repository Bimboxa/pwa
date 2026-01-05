import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

import { Box, Typography, ListItemButton } from "@mui/material";

import cv from "Features/opencv/services/opencvService";

export default function ToolMergeAnnotations({ baseMap }) {

    // strings

    const mergeS = "Fusionner les annotations avec le FDP";

    // data

    const baseMapAnnotations = useAnnotationsV2({ baseMapAnnotationsOnly: true });
    const updateBaseMapWithImageFile = useUpdateBaseMapWithImageEnhanced();

    // handlers

    async function handleMerge() {
        const annotations = baseMapAnnotations.filter(a => a.isEraser);
        console.log("debug_51_merge annotations", annotations, baseMapAnnotations);
        await cv.load();
        const { processedImageFile } = await cv.eraseFromAnnotations({
            imageUrl: baseMap.image.imageUrlClient,
            annotations,
        });

        if (processedImageFile) await updateBaseMapWithImageFile(baseMap.id, processedImageFile);
    }

    // render

    return <ListItemButton onClick={handleMerge}>
        <Typography variant="body2">{mergeS}</Typography>
    </ListItemButton>
}


