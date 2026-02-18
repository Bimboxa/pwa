import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMapListing from "../hooks/useMainBaseMapListing";

import {
    Box,
    Typography,
    Switch,
} from "@mui/material";

export default function FieldBaseMapShowEnhanced({ baseMap }) {

    // data

    const mainBaseMapListing = useMainBaseMapListing();
    const updateEntity = useUpdateEntity();

    // helpers

    let checked = Boolean(baseMap?.showEnhanced);

    const disabled = !baseMap?.imageEnhanced?.imageUrlClient


    // handlers

    function handleChange(e) {
        const newChecked = !checked;
        const updates = { showEnhanced: newChecked };
        if (newChecked) updates.opacityEnhanced = 0
        updateEntity(baseMap.id, updates, { listing: mainBaseMapListing });
    }

    // render

    return <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        p: 1,
        borderBottom: theme => `1px solid ${theme.palette.divider}`
    }}>
        <Typography variant="body2" color="text.secondary">Utiliser l'image améliorée</Typography>
        <Switch
            checked={checked}
            onChange={handleChange}
            size="small"
            disabled={disabled}
        />
    </Box>
}