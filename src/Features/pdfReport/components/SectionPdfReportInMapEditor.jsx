import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setShowBgImageInMapEditor } from "Features/bgImage/bgImageSlice";
import useDownladPdfReport from "../hooks/useDownladPdfReport";
import usePdfReportName from "../hooks/usePdfReportName";

import { styled, useTheme } from "@mui/material/styles";
import { FormControlLabel, Switch, Box, Paper, Button, Typography, CircularProgress, Divider } from "@mui/material";
import { Wallpaper as PdfIcon, Download as DownloadIcon } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SliderBaseMapOpacity from "Features/mapEditor/components/SliderBaseMapOpacity";
import SwitchBaseMapGrayScale from "Features/mapEditor/components/SwitchBaseMapGrayScale";

import editor from "App/editor";

// --- Custom MiniSwitch (inchangé) ---
const MiniSwitch = styled(Switch)(({ theme }) => ({
    width: 26,
    height: 14,
    padding: 0,
    display: 'flex',
    '& .MuiSwitch-switchBase': {
        padding: 2,
        '&.Mui-checked': {
            transform: 'translateX(12px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor: theme.palette.primary.main,
            },
        },
    },
    '& .MuiSwitch-thumb': {
        width: 10,
        height: 10,
        boxShadow: 'none',
    },
    '& .MuiSwitch-track': {
        borderRadius: 16 / 2,
        opacity: 1,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.25)',
        boxSizing: 'border-box',
    },
}));

export default function SectionPdfReportInMapEditor() {
    const dispatch = useDispatch();
    const theme = useTheme();

    // Data
    const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
    const exportPdf = useDownladPdfReport();
    const title = usePdfReportName();

    const [loading, setLoading] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Handlers
    function handleShowBgImageChange(show) {
        dispatch(setShowBgImageInMapEditor(show));
    }

    async function handleGenerateClick(e) {
        e.stopPropagation();
        setLoading(true);
        try {
            await exportPdf({
                svgElement: editor.printableMapSvgElement,
                name: title,
                addTable: true,
            });
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    }

    // Styles dynamiques
    // On a besoin d'un peu moins de largeur car le switch prend la place de l'icone
    const paperWidth = isHovered ? 240 : 40;
    const paperHeight = isHovered ? "auto" : 40;

    return (
        <Box sx={{ position: "relative", width: 40, height: 40, zIndex: 1200 }}>

            <Paper
                elevation={isHovered ? 6 : 0}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                sx={{
                    position: "absolute",
                    top: 0,
                    right: 0, // Ancrage à droite

                    width: paperWidth,
                    height: paperHeight,

                    display: "flex",
                    flexDirection: "column",

                    borderRadius: "20px",
                    bgcolor: "background.paper",
                    overflow: "hidden",

                    transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s",

                    cursor: "default",
                    border: isHovered ? "1px solid transparent" : `1px solid ${showBgImage ? theme.palette.secondary.main : theme.palette.divider}`,
                }}
            >
                {/* --- HEADER --- */}
                <Box
                    sx={{
                        height: 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end", // On cale tout à droite
                        width: "100%",
                        flexShrink: 0,
                    }}
                >
                    {/* 1. TEXTE (à gauche du switch) */}
                    <Box sx={{
                        opacity: isHovered ? 1 : 0,
                        // Le texte est "poussé" par l'animation de largeur du parent
                        // On limite sa largeur pour l'effet de transition
                        maxWidth: isHovered ? 180 : 0,
                        transition: "opacity 0.2s 0.1s, max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        whiteSpace: 'nowrap',
                        overflow: "hidden",
                        pr: 1 // Petit espace avant le switch
                    }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Mode impression
                        </Typography>
                    </Box>

                    {/* 2. ZONE D'INTERACTION SWAP (40x40 fixée à droite) */}
                    <Box
                        sx={{
                            position: "relative", // Pour superposer les enfants
                            width: 40,
                            height: 40,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        {/* A. L'Icone PDF (Visible par défaut) */}
                        <Box
                            sx={{
                                position: "absolute",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "opacity 0.2s, transform 0.2s",
                                opacity: isHovered ? 0 : 1, // Disparait au survol
                                transform: isHovered ? "scale(0.5)" : "scale(1)", // Petit effet de zoom out
                                color: showBgImage ? "secondary.main" : "text.secondary",
                            }}
                        >
                            <PdfIcon fontSize="small" />
                        </Box>

                        {/* B. Le Switch (Visible au survol) */}
                        <Box
                            sx={{
                                position: "absolute",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "opacity 0.2s 0.1s, transform 0.2s",
                                opacity: isHovered ? 1 : 0, // Apparait au survol
                                transform: isHovered ? "scale(1)" : "scale(0.5)", // Petit effet de zoom in
                            }}
                        >
                            <FormControlLabel
                                sx={{ m: 0 }}
                                label=""
                                control={
                                    <MiniSwitch
                                        checked={showBgImage}
                                        onChange={(e) => handleShowBgImageChange(e.target.checked)}
                                    />
                                }
                            />
                        </Box>
                    </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <SliderBaseMapOpacity />
                <SwitchBaseMapGrayScale />

                {/* --- FOOTER (Bouton Action) --- */}
                <Box
                    sx={{
                        mt: 2,
                        px: 2,
                        pb: 2,
                        pt: 0.5,
                        width: "100%",
                        opacity: isHovered ? 1 : 0,
                        height: isHovered ? "auto" : 0,
                        transition: "opacity 0.2s 0.1s",
                        pointerEvents: isHovered ? "auto" : "none",
                        display: "flex",
                        justifyContent: "center"
                    }}
                >
                    <ButtonGeneric
                        variant="contained"
                        size="small"
                        fullWidth
                        disabled={!showBgImage || loading}
                        onClick={handleGenerateClick}
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                        sx={{
                            textTransform: 'none',
                            whiteSpace: 'nowrap',
                            boxShadow: 'none'
                        }}
                        loading={loading}
                        label={loading ? "Génération..." : "Télécharger le PDF"}
                    />

                </Box>
            </Paper>
        </Box>
    );
}