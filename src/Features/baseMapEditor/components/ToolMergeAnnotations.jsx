import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";

import { Box, Typography, ListItemButton } from "@mui/material";

import cv from "Features/opencv/services/opencvService";

export default function ToolMergeAnnotations({ baseMap }) {

    // strings

    const mergeS = "Fusionner les annotations avec le FDP";

    // data

    const baseMapAnnotations = useAnnotationsV2({ caller: "ToolMergeAnnotations", baseMapAnnotationsOnly: true });
    const createVersion = useCreateBaseMapVersion();

    // handlers

    async function handleMerge() {
        const annotations = baseMapAnnotations.filter(a => a.isEraser);
        await cv.load();
        const { processedImageFile } = await cv.eraseFromAnnotations({
            imageUrl: baseMap.getUrl(),
            annotations,
        });

        if (processedImageFile) await createVersion(baseMap.id, processedImageFile, { label: "Fusion annotations" });
    }

    // render

    return <ListItemButton onClick={handleMerge}>
        <Typography variant="body2">{mergeS}</Typography>
    </ListItemButton>
}


