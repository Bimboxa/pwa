import { useState } from "react";
import useUpdateBaseMapWithImageEnhanced from "../hooks/useUpdateBaseMapWithImageEnhanced";

import { Box, IconButton, ListItem, ListItemButton, ListItemIcon, Typography } from "@mui/material";
// Ajout de l'import Compare
import { AddPhotoAlternate, Delete, Compare } from '@mui/icons-material';
import SelectorImage from "Features/images/components/SelectorImage";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function FieldBaseMapEnhancedImage({ baseMap }) {

    // strings
    const compareS = "Comparer avec original";
    const addImageS = "Ajouter une image";

    // state
    const [imageFile, setImageFile] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [openCompareDialog, setOpenCompareDialog] = useState(false);
    const [openDelete, setOpenDelete] = useState(false);

    // data
    const updateBaseMapWithImageEnhanced = useUpdateBaseMapWithImageEnhanced();

    // handlers
    async function handleCreate() {
        if (!imageFile) return;
        await updateBaseMapWithImageEnhanced(baseMap.id, imageFile);
        setOpenDialog(false);
        setImageFile(null);
    }

    async function handleDeleteConfirm() {
        await updateBaseMapWithImageEnhanced(baseMap.id, null);
        setOpenDelete(false);
    }

    function handleDelete() {
        setOpenDelete(true);
    }

    // helper
    const enhancedImage = baseMap?.imageEnhanced;
    const hasEnhancedImage = Boolean(enhancedImage);

    return (
        <>
            <ListItem
                disablePadding
                divider
                // CSS pour gérer l'affichage au survol sans décaler le layout
                sx={{
                    '& .MuiListItemSecondaryAction-root': {
                        visibility: 'hidden', // Caché par défaut mais garde l'espace
                    },
                    '&:hover .MuiListItemSecondaryAction-root': {
                        visibility: 'visible', // Visible au survol
                    },
                }}
                secondaryAction={
                    hasEnhancedImage && (
                        <IconButton edge="end" aria-label="delete" onClick={handleDelete}>
                            <Delete />
                        </IconButton>
                    )
                }
            >
                <ListItemButton
                    onClick={() => hasEnhancedImage ? setOpenCompareDialog(true) : setOpenDialog(true)}
                >
                    {/* Affiche Compare si image présente, sinon AddPhotoAlternate */}
                    <ListItemIcon>
                        {hasEnhancedImage ? <Compare /> : <AddPhotoAlternate />}
                    </ListItemIcon>

                    <Typography variant="body2" color="text.secondary">
                        {hasEnhancedImage ? compareS : addImageS}
                    </Typography>
                </ListItemButton>
            </ListItem>

            {/* Dialog d'ajout */}
            <DialogGeneric open={openDialog} onClose={() => setOpenDialog(false)}>
                <Box sx={{ width: 500, height: 300, p: 1 }}>
                    <SelectorImage onImageFileChange={setImageFile} />
                </Box>
                <BoxAlignToRight sx={{ p: 1 }}>
                    <ButtonGeneric label="Enregistrer" onClick={handleCreate} />
                </BoxAlignToRight>
            </DialogGeneric>

            {/* Dialog de comparaison */}
            {openCompareDialog && (
                <DialogGeneric open={openCompareDialog} onClose={() => setOpenCompareDialog(false)} vh={70}>
                    <SectionCompareTwoImages imageUrl2={baseMap?.image?.imageUrlClient} imageUrl1={enhancedImage?.imageUrlClient} />
                </DialogGeneric>
            )}

            {/* Dialog de confirmation de suppression */}
            <DialogDeleteRessource open={openDelete} onClose={() => setOpenDelete(false)} onConfirmAsync={handleDeleteConfirm} />
        </>
    );
}