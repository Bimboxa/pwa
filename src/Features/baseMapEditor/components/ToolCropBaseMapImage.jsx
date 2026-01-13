import { useState } from "react";

import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

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

    const update = useUpdateBaseMapWithImageEnhanced()

    // helpers

    const imageUrl = baseMap?.getUrl()

    // handlers

    async function updateWithFile(file) {
        await update(baseMap?.id, file)
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
