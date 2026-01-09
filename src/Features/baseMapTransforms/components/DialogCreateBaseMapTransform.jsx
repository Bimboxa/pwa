import { useState } from "react"
import { nanoid } from "@reduxjs/toolkit"

import { Box, Typography } from '@mui/material'

import DialogGeneric from "Features/layout/components/DialogGeneric"
import FormBaseMapTransform from "./FormBaseMapTransform"
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2"

import db from "App/db/db"



export default function DialogCreateBaseMapTransform({ open, onClose }) {

    // helpers

    const descriptionS = `Définissez l'image que vous souhaitez générer.
    Testez au préalable sur Gemini.`

    // state

    const [tempBaseMapTransform, setTempBaseMapTransform] = useState({})

    // handlers

    function handleChange(transform) {
        setTempBaseMapTransform(transform)
    }

    async function handleSave() {
        const newTransform = {
            id: nanoid(),
            ...tempBaseMapTransform,
        }
        await db.baseMapTransforms.add(newTransform)
        onClose();
    }

    return <DialogGeneric open={open} onClose={onClose} width={500}>
        <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>{descriptionS}</Typography>
        </Box>
        <FormBaseMapTransform baseMapTransform={tempBaseMapTransform} onChange={handleChange} />
        <ButtonInPanelV2 disabled={!tempBaseMapTransform.name && !tempBaseMapTransform.prompt} onClick={handleSave} label="Ajouter la transformation" variant="contained" color="secondary" />
    </DialogGeneric>

}