import { useState } from "react";

import useUpdateBaseMapWithImageEnhanced from "../hooks/useUpdateBaseMapWithImageEnhanced";

import { Box, IconButton, Typography } from "@mui/material";
import ImageGeneric from "Features/images/components/ImageGeneric";

import { AddPhotoAlternate, Delete } from '@mui/icons-material';
import SelectorImage from "Features/images/components/SelectorImage";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function FieldBaseMapEnhancedImage({ baseMap }) {

    // state

    const [imageFile, setImageFile] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);

    // data

    const updateBaseMapWithImageEnhanced = useUpdateBaseMapWithImageEnhanced();

    // handlers

    async function handleCreate() {
        if (!imageFile) return;
        await updateBaseMapWithImageEnhanced(baseMap.id, imageFile);
        setOpenDialog(false);
    }

    async function handleDelete() {
        await updateBaseMapWithImageEnhanced(baseMap.id, null);
    }

    // helper

    const enhancedImage = baseMap?.imageEnhanced;

    // helper - no enhanced image

    const noEnhancedImage = !Boolean(enhancedImage);

    // render

    if (noEnhancedImage) return <><Box sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: 1, borderBottom: theme => `1px solid ${theme.palette.divider}`
    }}>
        <Typography variant="body2" color="text.secondary">Aucune image</Typography>
        <IconButton onClick={() => setOpenDialog(true)}>
            <AddPhotoAlternate />
        </IconButton>
    </Box>

        <DialogGeneric open={openDialog} onClose={() => setOpenDialog(false)}>
            <Box sx={{ width: 500, height: 300, p: 1 }}>
                <SelectorImage onImageFileChange={setImageFile} />
            </Box>
            <BoxAlignToRight sx={{ p: 1 }}>
                <ButtonGeneric label="Enregistrer" onClick={handleCreate} />
            </BoxAlignToRight>
        </DialogGeneric>
    </>

    return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1, borderBottom: theme => `1px solid ${theme.palette.divider}` }}>
        <Box>
            <ImageGeneric url={enhancedImage?.imageUrlClient} height={50} />
        </Box>
        <IconButton onClick={handleDelete}>
            <Delete />
        </IconButton>
    </Box>

}