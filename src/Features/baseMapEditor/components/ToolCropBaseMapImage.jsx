import { useState } from "react";

import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";

import { ListItemButton, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ImageCropper from "Features/images/components/ImageCropper";

export default function ToolCropBaseMapImage({ baseMap }) {

    // strings

    const cropS = "Cropper l'image";

    // state

    const [open, setOpen] = useState(false)

    // data

    const createVersion = useCreateBaseMapVersion()

    // helpers

    const imageUrl = baseMap?.getUrl()

    // handlers

    async function updateWithFile(file) {
        await createVersion(baseMap?.id, file, { label: "Recadrage" })
        setOpen(false)
    }

    function handleOpen() {
        setOpen(true)
    }

    return <>

        <ListItemButton onClick={handleOpen} divider>
            <Typography variant="body2">{cropS}</Typography>
        </ListItemButton>

        <DialogGeneric open={open} onClose={() => setOpen(false)} vh={70} vw={70}>
            <BoxFlexVStretch sx={{ width: 1 }}>
                <ImageCropper imageUrl={imageUrl} onCroppedImage={updateWithFile} onCancel={() => setOpen(false)} />
            </BoxFlexVStretch>
        </DialogGeneric>
    </>

}
