import { useState } from "react";

import { Box, Typography, IconButton } from "@mui/material";

import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import rotateImageAsync from "Features/images/utils/rotateImageAsync";

export default function ListItemButtonBaseMapRotate({ baseMap }) {

    // strings

    const rotateS = "Rotation du fond de plan (°)";

    // data

    const updateBaseMap = useUpdateBaseMapWithImageEnhanced();

    // state

    const [rotation, setRotation] = useState(0);
    const [loading, setLoading] = useState(false);

    // handlers

    async function rotate() {
        setLoading(true);
        const imageUrl = baseMap.getUrl();
        const file = await rotateImageAsync({ imageUrl, rotation });
        updateBaseMap(baseMap.id, file);
        setLoading(false);
    }

    // render

    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1 }}>
            <Typography variant="body2" color="text.secondary">
                {rotateS}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 50 }}>
                    <FieldTextV2 value={rotation} onChange={setRotation} options={{ fullWidth: true }} />
                </Box>
                <IconButton size="small" onClick={rotate} loading={loading}>
                    <RotateLeftIcon />
                </IconButton>
            </Box>
        </Box>
    );
}