import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import {
    Box,
    Typography,
    Switch,
} from "@mui/material";

export default function FieldBaseMapShowEnhanced({ baseMap }) {

    // data

    const updateEntity = useUpdateEntity();

    // helpers

    const checked = Boolean(baseMap?.showEnhanced);

    const disabled = !baseMap?.imageEnhanced?.imageUrlClient


    // handlers

    function handleChange(e) {
        const updates = { showEnhanced: e.target.checked };
        updateEntity(baseMap.id, updates);
    }

    // render

    return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1 }}>
        <Typography variant="body2" color="text.secondary">Afficher l'image améliorée</Typography>
        <Switch
            checked={checked}
            onChange={handleChange}
            size="small"
            disabled={disabled}
        />
    </Box>
}