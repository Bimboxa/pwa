import { useSelector, useDispatch } from "react-redux";
import { removeTempBaseMap } from "../baseMapCreatorSlice";
import { Box, Typography, CircularProgress, IconButton } from "@mui/material";
import { Delete } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonCreateBaseMaps from "./ButtonCreateBaseMaps";

import stringifyFileSize from "Features/files/utils/stringifyFileSize";

export default function SectionPreviewBaseMaps() {
    const dispatch = useDispatch();

    const tempBaseMaps = useSelector((state) => state.baseMapCreator.tempBaseMaps);

    // helpers
    const items = tempBaseMaps.map((baseMap) => {
        const item = {
            id: baseMap.id,
            name: baseMap.name,
        }
        if (baseMap.imageFile) {
            item.imageUrl = URL.createObjectURL(baseMap.imageFile);
            item.fileSize = stringifyFileSize(baseMap.imageFile.size);
        }
        return item
    })

    // handlers
    function handleRemoveBaseMap(id) {
        console.log("remove", id)
        dispatch(removeTempBaseMap({ id }));
    }

    // render
    return (
        <BoxFlexVStretch sx={{ p: 1, gap: 1 }}>
            <BoxFlexVStretch sx={{ overflow: "auto" }}>
                {items.map((item) => {
                    return (
                        <Box
                            key={item.id}
                            sx={{
                                // Indispensable pour que le 'absolute' de l'enfant se réfère à ce bloc
                                position: "relative",
                                border: theme => `1px solid ${theme.palette.divider}`,

                                // Logique de survol CSS :
                                // Quand on survole CE box, on cible l'enfant avec la classe '.delete-btn'
                                "&:hover .delete-btn": {
                                    opacity: 1,
                                    visibility: "visible"
                                }
                            }}
                        >
                            {/* --- TITRE --- */}
                            <Box sx={{ position: "absolute", top: "4px", left: "4px", zIndex: 2, bgcolor: "primary.main", color: "white", borderRadius: "4px", px: 0.5 }}>
                                <Typography variant="body2">{item.name}</Typography>
                            </Box>


                            {/* --- BOUTON DE SUPPRESSION --- */}
                            <Box
                                className="delete-btn"
                                sx={{
                                    position: "absolute",
                                    top: 0,
                                    right: 0,
                                    zIndex: 2,
                                    opacity: 0, // Caché par défaut
                                    visibility: "hidden", // Pour éviter de cliquer dessus quand invisible
                                    transition: "all 0.2s ease-in-out",
                                    bgcolor: "rgba(255, 255, 255, 0.8)", // Fond semi-transparent pour lisibilité
                                    borderRadius: "50%"
                                }}
                            >
                                <IconButton onClick={() => handleRemoveBaseMap(item.id)} size="small">
                                    <Delete fontSize="small" />
                                </IconButton>
                            </Box>

                            {item.fileSize && <Typography sx={{
                                position: "absolute",
                                bottom: 4,
                                left: 4,
                                zIndex: 2,
                                bgcolor: "rgba(255, 255, 255, 0.8)",
                                borderRadius: "8px",
                                padding: 0.5,
                                fontSize: 10
                            }}>{item.fileSize}</Typography>}

                            {/* --- CONTENU (Image ou Loader) --- */}
                            {item.imageUrl ? (
                                <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    style={{ display: "block", width: "100%" }}
                                />
                            ) : (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexDirection: "column", p: 1 }}>
                                    <Typography variant="body2">{item.name}</Typography>
                                    <CircularProgress size={20} />
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </BoxFlexVStretch>
            <ButtonCreateBaseMaps />
        </BoxFlexVStretch>
    );
}