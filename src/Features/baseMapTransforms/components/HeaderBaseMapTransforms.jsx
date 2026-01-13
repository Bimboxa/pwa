import { useState } from "react";

import { Box, IconButton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import DialogCreateBaseMapTransform from "./DialogCreateBaseMapTransform";


export default function HeaderBaseMapTransforms() {

    // strings

    const transformationsS = "Transformations (IA) "

    // data

    const [open, setOpen] = useState(false)

    return <>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 1, px: 1 }}>
            <Typography variant="body2" color="text.secondary">{transformationsS}</Typography>
            <IconButton onClick={() => setOpen(true)}>
                <AddIcon />
            </IconButton>
        </Box>

        <DialogCreateBaseMapTransform open={open} onClose={() => setOpen(false)} />
    </>
}