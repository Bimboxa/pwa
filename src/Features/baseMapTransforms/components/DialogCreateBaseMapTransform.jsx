import { useState } from "react"
import { nanoid } from "@reduxjs/toolkit"

import DialogGeneric from "Features/layout/components/DialogGeneric"
import FormBaseMapTransform from "./FormBaseMapTransform"
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2"

import db from "App/db/db"



export default function DialogCreateBaseMapTransform({ open, onClose }) {

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
        <FormBaseMapTransform baseMapTransform={tempBaseMapTransform} onChange={handleChange} />
        <ButtonInPanelV2 onClick={handleSave} label="Créer" />
    </DialogGeneric>

}