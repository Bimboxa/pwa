import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import { ListItemButton, Typography } from "@mui/material";

export default function ToolResetBaseMapEnhancedImage({ baseMap }) {
    // strings

    const resetS = "Réinitialiser l'image améliorée";

    // data

    const updateEntity = useUpdateEntity();

    // handlers

    async function handleReset() {
        const updates = { showEnhanced: false, imageEnhanced: null };
        await updateEntity(baseMap.id, updates);
    }

    // render

    return <ListItemButton onClick={handleReset}>
        <Typography variant="body2">{resetS}</Typography>
    </ListItemButton>
}