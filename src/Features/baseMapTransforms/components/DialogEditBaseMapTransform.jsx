import { useState, useEffect } from "react" // Ajout de useEffect
import { nanoid } from "@reduxjs/toolkit"

import DialogGeneric from "Features/layout/components/DialogGeneric"
import FormBaseMapTransform from "./FormBaseMapTransform"
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2"

import db from "App/db/db"

export default function DialogEditBaseMapTransform({ open, onClose, initialBaseMapTransform }) {

    // state
    // On initialise avec initialBaseMapTransform ou un objet vide par sécurité
    const [tempBaseMapTransform, setTempBaseMapTransform] = useState(initialBaseMapTransform || {})

    // EFFECT: Indispensable pour mettre à jour le formulaire si la prop change
    // (par exemple si on ouvre le dialogue pour un item, on ferme, puis on rouvre pour un autre)
    useEffect(() => {
        if (open && initialBaseMapTransform) {
            setTempBaseMapTransform(initialBaseMapTransform)
        } else if (open && !initialBaseMapTransform) {
            // Cas où on ouvre pour créer un nouveau (reset du formulaire)
            // Vous pouvez définir ici des valeurs par défaut si nécessaire
            setTempBaseMapTransform({})
        }
    }, [open, initialBaseMapTransform])

    // handlers

    function handleChange(transform) {
        // On fusionne l'ancien état avec les changements pour ne rien perdre
        setTempBaseMapTransform(prev => ({ ...prev, ...transform }))
    }

    async function handleSave() {
        // Si l'objet a déjà un ID, on le garde. Sinon, on en génère un nouveau.
        const idToUse = tempBaseMapTransform.id || nanoid()

        const transformToSave = {
            ...tempBaseMapTransform,
            id: idToUse,
        }

        // db.put() gère à la fois la création (si l'ID n'existe pas)
        // et la mise à jour (si l'ID existe déjà).
        await db.baseMapTransforms.put(transformToSave)

        onClose();
    }

    // Calcul du libellé du bouton pour l'UX
    const isEditing = !!initialBaseMapTransform?.id;

    return (
        <DialogGeneric open={open} onClose={onClose} width={500}>
            <FormBaseMapTransform
                baseMapTransform={tempBaseMapTransform}
                onChange={handleChange}
            />
            <ButtonInPanelV2
                onClick={handleSave}
                label={isEditing ? "Enregistrer" : "Créer"}
            />
        </DialogGeneric>
    )
}