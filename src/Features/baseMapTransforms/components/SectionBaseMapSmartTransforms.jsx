import { useState } from "react";
import { useDispatch, useSelector } from "react-redux"; // Ajout pour dispatch
import useBaseMapTransforms from "../hooks/useBaseMapTransforms";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap"; // Pour récupérer le fichier et l'ID
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

import {
    Box,
    List,
    ListItem,
    ListItemText,
    IconButton,
    ListItemButton,
    Menu,
    MenuItem,
    Typography,
    CircularProgress
} from "@mui/material";
import { MoreVert, Edit, Delete, Stop, Compare } from "@mui/icons-material";

import HeaderBaseMapTransforms from "./HeaderBaseMapTransforms";
import DialogEditBaseMapTransform from "./DialogEditBaseMapTransform";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionCompareTwoImages from "./SectionCompareTwoImages";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import db from "App/db/db";

import enhanceBaseMapService from "Features/baseMaps/services/enhanceBaseMapService";
import { cancelEnhanceBaseMap } from "Features/baseMaps/services/enhanceBaseMapService";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function SectionBaseMapTransforms() {

    const dispatch = useDispatch();

    // --- Data ---
    const baseMapTransforms = useBaseMapTransforms();
    const baseMap = useMainBaseMap(); // Nécessaire pour avoir l'ID et le fichier image
    const enhancedResult = useSelector(
        (s) => s.baseMaps?.enhancedImageResults?.[baseMap?.id]
    );
    const updateBaseMapWithImageEnhanced = useUpdateBaseMapWithImageEnhanced();

    // --- State ---
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [activeTransform, setActiveTransform] = useState(null); // Pour le menu/dialogues
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [openDelete, setOpenDelete] = useState(false);
    const [openCompare, setOpenCompare] = useState(false);

    // State pour savoir quel ID de transform est en cours de traitement
    const [enhancingTransformId, setEnhancingTransformId] = useState(null);

    // --- Handlers Menu/CRUD ---

    const handleOpenMenu = (event, transform) => {
        // On empêche d'ouvrir le menu si une action est déjà en cours sur cet élément
        if (enhancingTransformId === transform.id) return;

        event.stopPropagation(); // Empêche de cliquer sur la ligne en même temps
        setMenuAnchor(event.currentTarget);
        setActiveTransform(transform);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
    };

    const handleEdit = () => {
        handleCloseMenu();
        setIsDialogOpen(true);
    };

    const handleOpenCompare = () => {
        handleCloseMenu();
        setOpenCompare(true);
    };

    const handleDelete = () => {
        if (activeTransform) {
            setOpenDelete(true);
        }
        handleCloseMenu();
    };

    async function handleDeleteConfirm() {
        if (activeTransform) {
            await db.baseMapTransforms.delete(activeTransform.id)
        }
        setOpenDelete(false);
    }

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setActiveTransform(null);
    };

    // --- Handlers Service d'amélioration ---

    const handleTransformClick = (transform) => {
        // 1. Vérifications de sécurité
        if (!baseMap?.image?.file || !baseMap?.id) {
            console.warn("Aucune BaseMap ou image sélectionnée");
            return;
        }

        // Si une autre action est déjà en cours, on ne fait rien (ou on pourrait annuler l'autre)
        if (enhancingTransformId) return;

        // 2. Set loading state local
        setEnhancingTransformId(transform.id);

        // 3. Appel du service
        enhanceBaseMapService({
            baseMapId: baseMap.id,
            file: baseMap.image.file,
            prompt: transform.prompt, // On utilise le prompt de l'objet transform
            dispatch,
            onSuccess: () => {
                setEnhancingTransformId(null);
                setOpenCompare(true)
            },
            onError: () => {
                setEnhancingTransformId(null);
            },
        }).catch(() => {
            setEnhancingTransformId(null);
        });
    };

    const handleAbort = (e, transformId) => {
        e.stopPropagation(); // Empêche le clic sur la ligne
        if (baseMap?.id) {
            cancelEnhanceBaseMap(baseMap.id);
        }
        setEnhancingTransformId(null);
    };

    async function handleEnhanceImage() {
        if (!enhancedResult?.blob) return;
        const file = new File([enhancedResult.blob], "enhanced.png");
        await updateBaseMapWithImageEnhanced(baseMap.id, file);
        setOpenCompare(false)
    }

    // --- Render ---

    return (
        <>
            <Box>
                <HeaderBaseMapTransforms />

                <List>
                    {baseMapTransforms?.map((transform) => {

                        const isEnhancingThis = enhancingTransformId === transform.id;

                        return (
                            <ListItem
                                key={transform.id}
                                disablePadding
                                divider
                                // Logique conditionnelle pour l'action secondaire
                                secondaryAction={
                                    isEnhancingThis ? (
                                        // Cas CHARGEMENT : Spinner + Bouton Stop
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }} >
                                            <CircularProgress size={20} color="secondary" />
                                            <IconButton
                                                edge="end"
                                                onClick={(e) => handleAbort(e, transform.id)}
                                                color="error"
                                                size="small"
                                            >
                                                <Stop fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ) : (
                                        // Cas NORMAL : Menu contextuel (visible au hover via CSS)
                                        <IconButton
                                            edge="end"
                                            onClick={(e) => handleOpenMenu(e, transform)}
                                        >
                                            <MoreVert />
                                        </IconButton>
                                    )
                                }
                                sx={{
                                    bgcolor: "white",
                                    // Si en chargement, on garde l'action visible. 
                                    // Sinon, on applique l'effet d'apparition au survol.
                                    '& .MuiListItemSecondaryAction-root': {
                                        opacity: isEnhancingThis ? 1 : 0,
                                        transition: 'opacity 0.2s',
                                        pointerEvents: isEnhancingThis ? 'auto' : 'none'
                                    },
                                    '&:hover .MuiListItemSecondaryAction-root': {
                                        opacity: 1,
                                        pointerEvents: 'auto'
                                    }
                                }}
                            >
                                <ListItemButton
                                    onClick={() => handleTransformClick(transform)}
                                    disabled={!!enhancingTransformId && !isEnhancingThis} // Désactive les autres lignes si une est en cours
                                    selected={isEnhancingThis}
                                >
                                    <Typography variant="body2" color="text.secondary">{transform.name}</Typography>
                                </ListItemButton>
                            </ListItem >
                        );
                    })}
                </List >
            </Box >

            {/* MENU CONTEXTUEL */}
            < Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
            >
                {enhancedResult && <MenuItem onClick={handleOpenCompare}>
                    <Compare fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography>Dernier résultat</Typography>
                </MenuItem>}
                <MenuItem onClick={handleEdit}>
                    <Edit fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography>Modifier</Typography>
                </MenuItem>
                <MenuItem onClick={handleDelete}>
                    <Delete fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
                    <Typography color="error">Supprimer</Typography>
                </MenuItem>
            </Menu >

            {/* DIALOGUES */}
            {
                activeTransform && (
                    <DialogEditBaseMapTransform
                        open={isDialogOpen}
                        onClose={handleCloseDialog}
                        initialBaseMapTransform={activeTransform}
                    />
                )
            }

            <DialogDeleteRessource
                open={openDelete}
                onClose={() => setOpenDelete(false)}
                onConfirmAsync={handleDeleteConfirm}

            />

            {
                openCompare && <DialogGeneric open={openCompare} vh={70} onClose={() => setOpenCompare(false)}>

                    <BoxFlexVStretch sx={{ width: 1, height: 1, position: "relative" }}>
                        <SectionCompareTwoImages
                            imageUrl2={baseMap.image.imageUrlClient}
                            imageUrl1={enhancedResult.objectUrl}

                        />
                        <Box sx={{ position: "absolute", bottom: "8px", right: "8px" }}>
                            <ButtonGeneric
                                label="Utiliser l'image modifiée"
                                variant="contained"
                                color="secondary"
                                onClick={handleEnhanceImage}
                            />
                        </Box>
                    </BoxFlexVStretch>
                </DialogGeneric>
            }
        </>
    );
}