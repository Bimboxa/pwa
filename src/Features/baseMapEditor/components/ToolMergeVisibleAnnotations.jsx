import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import { ListItemButton, Typography } from "@mui/material";

import mergeAnnotationsOnImage from "../utils/mergeAnnotationsOnImage";

export default function ToolMergeVisibleAnnotations({ baseMap, onResult }) {

    // data

    const annotations = useAnnotationsV2({
        caller: "ToolMergeVisibleAnnotations",
        filterByMainBaseMap: true,
        sortByOrderIndex: true,
        excludeBgAnnotations: true,
    });

    // handlers

    async function handleMerge() {
        if (!annotations?.length || !baseMap) return;

        const imageUrl = baseMap.getUrl();
        const refSize = baseMap.getImageSize();
        const imageTransform = baseMap.getActiveVersionTransform();
        const meterByPx = baseMap.getMeterByPx();

        const result = await mergeAnnotationsOnImage({
            imageUrl,
            imageTransform,
            refSize,
            annotations,
            meterByPx,
        });

        if (result?.file && onResult) {
            onResult(result.file, "Fusion annotations");
        }
    }

    // render

    return (
        <ListItemButton onClick={handleMerge} divider>
            <Typography variant="body2" color="text.secondary">
                Fusionner les annotations
            </Typography>
        </ListItemButton>
    );
}
