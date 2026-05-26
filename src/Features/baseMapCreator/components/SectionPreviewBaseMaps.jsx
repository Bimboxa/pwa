import { useSelector, useDispatch } from "react-redux";
import { removeTempBaseMap } from "../baseMapCreatorSlice";
import { Box, Typography, CircularProgress, IconButton, Divider } from "@mui/material";
import { Delete, ImageOutlined } from "@mui/icons-material";

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
        };
        if (baseMap.imageFile) {
            item.imageUrl = URL.createObjectURL(baseMap.imageFile);
            item.fileSize = stringifyFileSize(baseMap.imageFile.size);
        }
        return item;
    });

    const count = items.length;
    const isEmpty = count === 0;

    // handlers
    function handleRemoveBaseMap(id) {
        dispatch(removeTempBaseMap({ id }));
    }

    // render
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            bgcolor: "background.paper",
        }}>
            {/* --- HEADER --- */}
            <Box sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
            }}>
                <Typography variant="subtitle2">
                    Fonds de plan à créer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {count}
                </Typography>
            </Box>
            <Divider />

            {/* --- LIST (scrollable) --- */}
            <Box sx={{
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
            }}>
                {items.map((item) => (
                    <Box
                        key={item.id}
                        sx={{
                            position: "relative",
                            border: theme => `1px solid ${theme.palette.divider}`,
                            borderRadius: 1,
                            overflow: "hidden",
                            "&:hover .delete-btn": {
                                opacity: 1,
                                visibility: "visible",
                            },
                        }}
                    >
                        {/* --- TITRE --- */}
                        <Box sx={{
                            position: "absolute",
                            top: "4px",
                            left: "4px",
                            zIndex: 2,
                            bgcolor: "primary.main",
                            color: "white",
                            borderRadius: "4px",
                            px: 0.5,
                        }}>
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
                                opacity: 0,
                                visibility: "hidden",
                                transition: "all 0.2s ease-in-out",
                                bgcolor: "rgba(255, 255, 255, 0.8)",
                                borderRadius: "50%",
                            }}
                        >
                            <IconButton onClick={() => handleRemoveBaseMap(item.id)} size="small">
                                <Delete fontSize="small" />
                            </IconButton>
                        </Box>

                        {item.fileSize && (
                            <Typography sx={{
                                position: "absolute",
                                bottom: 4,
                                left: 4,
                                zIndex: 2,
                                bgcolor: "rgba(255, 255, 255, 0.8)",
                                borderRadius: "8px",
                                padding: 0.5,
                                fontSize: 10,
                            }}>
                                {item.fileSize}
                            </Typography>
                        )}

                        {/* --- CONTENU (Image ou Loader) --- */}
                        {item.imageUrl ? (
                            <img
                                src={item.imageUrl}
                                alt={item.name}
                                style={{ display: "block", width: "100%" }}
                            />
                        ) : (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexDirection: "column", p: 2 }}>
                                <Typography variant="body2">{item.name}</Typography>
                                <CircularProgress size={20} />
                            </Box>
                        )}
                    </Box>
                ))}

                {/* --- HINT (when at least one item) --- */}
                {!isEmpty && (
                    <Box sx={{
                        border: theme => `1px dashed ${theme.palette.divider}`,
                        borderRadius: 1,
                        p: 1.5,
                        textAlign: "center",
                    }}>
                        <Typography variant="caption" color="text.secondary">
                            Sélectionnez une page puis cliquez sur{" "}
                            <Box component="span" sx={{ fontWeight: "bold" }}>Ajouter</Box>
                            {" "}pour en ajouter un autre.
                        </Typography>
                    </Box>
                )}

                {/* --- EMPTY STATE --- */}
                {isEmpty && (
                    <Box sx={{
                        flex: 1,
                        minHeight: 120,
                        border: theme => `1px dashed ${theme.palette.divider}`,
                        borderRadius: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        p: 2,
                        color: "text.secondary",
                    }}>
                        <ImageOutlined fontSize="small" />
                        <Typography variant="caption" textAlign="center">
                            Aucun fond de plan ajouté pour l'instant.
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* --- CTA FOOTER --- */}
            <Box sx={{
                borderTop: theme => `1px solid ${theme.palette.divider}`,
                p: 1.5,
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
            }}>
                <ButtonCreateBaseMaps />
                <Typography variant="caption" color="text.secondary">
                    Cette action ferme le dialogue.
                </Typography>
            </Box>
        </Box>
    );
}
