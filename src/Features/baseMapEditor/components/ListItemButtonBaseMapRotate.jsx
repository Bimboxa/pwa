import { useState } from "react";

import { Box, Typography, IconButton } from "@mui/material";

import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import rotateImageAsync from "Features/images/utils/rotateImageAsync";

export default function ListItemButtonBaseMapRotate({ baseMap }) {

    // strings

    const rotateS = "Rotation du fond de plan (°)";

    // data

    const createVersion = useCreateBaseMapVersion();

    // state

    const [rotation, setRotation] = useState(0);
    const [loading, setLoading] = useState(false);

    // handlers

    async function rotate() {
        setLoading(true);
        const imageUrl = baseMap.getUrl();
        const file = await rotateImageAsync({ imageUrl, rotation });
        await createVersion(baseMap.id, file, { label: `Rotation ${rotation}°` });
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