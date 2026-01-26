import { Box, ListItemButton, List, Typography } from "@mui/material"; // J'ai retiré Skeleton et ajouté Typography
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function SelectorPdfPage({ pageNumber, thumbnails, onPageNumberChange }) {
    return (
        <BoxFlexVStretch sx={{
            display: "flex",
            gap: 1,
            flexDirection: "column",
            alignItems: "center",
            minWidth: 0,
            width: 1,
        }}>
            <List sx={{ width: 1 }}>
                {thumbnails.map(({ imageUrl, status }, index) => {
                    const currentNum = index + 1;
                    const selected = pageNumber === currentNum;
                    const pending = status === "pending";

                    // Si erreur, on peut aussi vouloir afficher le rectangle (optionnel)
                    // const showPlaceholder = pending || status === "error";

                    return (
                        <ListItemButton
                            selected={selected}
                            key={index}
                            onClick={() => onPageNumberChange(currentNum)}
                            sx={{
                                // Un peu de padding pour que le border 'selected' ne colle pas à l'image
                                p: 1,
                                display: 'flex',
                                justifyContent: 'center'
                            }}
                        >
                            {pending ? (
                                // --- LE RECTANGLE (Placeholder) ---
                                <Box sx={{
                                    width: "100%",
                                    // Ratio A4 pour garder la forme de la page
                                    aspectRatio: "210 / 297",
                                    // Fallback height si aspectRatio n'est pas supporté (vieux navigateurs)
                                    minHeight: "140px",

                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",

                                    // Styles visuels
                                    bgcolor: "action.hover", // Gris clair adapté au thème (Light/Dark)
                                    border: "1px dashed",     // Bordure pointillée pour signifier "en attente"
                                    borderColor: "text.disabled",
                                    borderRadius: 1,
                                    color: "text.secondary"
                                }}>
                                    <Typography variant="h6" component="span" fontWeight="bold">
                                        {currentNum}
                                    </Typography>
                                </Box>
                            ) : (
                                // --- L'IMAGE ---
                                <img
                                    width={"100%"}
                                    src={imageUrl}
                                    alt={`Page ${currentNum}`}
                                    style={{
                                        // Petit style pour que l'image soit propre
                                        display: "block",
                                        borderRadius: "4px",
                                        boxShadow: "0px 2px 4px rgba(0,0,0,0.1)"
                                    }}
                                />
                            )}
                        </ListItemButton>
                    );
                })}
            </List>
        </BoxFlexVStretch>
    );
}