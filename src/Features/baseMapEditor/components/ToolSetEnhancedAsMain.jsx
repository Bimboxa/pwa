import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import { ListItemButton, Typography } from "@mui/material";

export default function ToolSetEnhancedAsMain({ baseMap }) {

    // strings

    const resetS = "Définir comme image d'origine"
    // data

    const updateEntity = useUpdateEntity()

    // helpers

    const disabled = !baseMap?.imageEnhanced

    // handlers

    async function handleClick() {

        const updates = {
            showEnhanced: false,
            image: { file: baseMap.imageEnhanced.file },
            imageEnhanced: null,
            meterByPx: baseMap.getMeterByPx({ variant: "imageEnhanced" })
        };
        await updateEntity(baseMap.id, updates);

    }

    // render

    return <ListItemButton onClick={handleClick} disabled={disabled} divider>
        <Typography variant="body2">{resetS}</Typography>
    </ListItemButton>
}