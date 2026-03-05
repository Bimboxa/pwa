

import { Box, Typography } from "@mui/material";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

export default function SectionBaseMapSizeInfo({ baseMap }) {

    // helpers

    const imageSize = baseMap?.getImageSize();
    const activeVersion = baseMap?.getActiveVersion?.();
    const imageFile = activeVersion?.image?.file ?? baseMap?.image?.file;


    // helper - sizeLabel

    const fileSizeS = stringifyFileSize(imageFile?.size);
    const ratio = imageSize?.width / imageSize?.height;
    const sizeLabel = `${imageSize?.width} x ${imageSize?.height} (${ratio.toFixed(2)}) - ${fileSizeS}`;

    // render

    return <Box sx={{
        p: 1,
        borderBottom: theme => `1px solid ${theme.palette.divider}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    }}>
        <Typography variant="body2" color="text.secondary">Taille de l'image</Typography>
        <Typography variant="body2" color="text.secondary">{sizeLabel}</Typography>
    </Box>
}