import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { styled, useTheme } from "@mui/material/styles";
import { Switch, Box, Typography, CircularProgress, Divider, FormControlLabel } from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";

import { setShowBgImageInMapEditor } from "Features/bgImage/bgImageSlice";
import useDownladPdfReport from "Features/pdfReport/hooks/useDownladPdfReport";
import usePdfReportName from "Features/pdfReport/hooks/usePdfReportName";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SliderBaseMapOpacity from "Features/mapEditor/components/SliderBaseMapOpacity";
import SwitchBaseMapGrayScale from "Features/mapEditor/components/SwitchBaseMapGrayScale";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import editor from "App/editor";

// --- Custom MiniSwitch (conservé pour le style) ---
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

export default function PanelExport() {
    const dispatch = useDispatch();

    // Data
    const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
    const exportPdf = useDownladPdfReport();
    const title = usePdfReportName();

    const [loading, setLoading] = useState(false);

    // Handlers
    function handleShowBgImageChange(show) {
        dispatch(setShowBgImageInMapEditor(show));
    }

    async function handleGenerateClick() {
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

    return (
        <BoxFlexVStretch sx={{ p: 2, gap: 2 }}>

            {/* --- HEADER: Toggle Mode --- */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Mode impression
                </Typography>

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

            <Divider />

            {/* --- BODY: Controls --- */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SliderBaseMapOpacity />
                <SwitchBaseMapGrayScale />
            </Box>

            {/* --- FOOTER: Action --- */}
            <Box sx={{ mt: 'auto' }}>
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

        </BoxFlexVStretch>
    );
}