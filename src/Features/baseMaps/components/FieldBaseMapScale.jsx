import { useState, useEffect } from "react";
import { Box, Typography, IconButton, Button } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import DialogGeneric from "Features/layout/components/DialogGeneric";

// On suppose que le hook est importé ici, ajustez le chemin si nécessaire
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

export default function FieldBaseMapScale({ baseMap }) {
    const updateEntity = useUpdateEntity();

    // --- Strings ---
    const noScaleS = "Le fond de plan n'est pas à l'échelle";
    const saveS = "Enregistrer";

    // --- State ---
    const [open, setOpen] = useState(false);
    const [tempMeterByPx, setTempMeterByPx] = useState("");

    useEffect(() => {
        // On initialise la valeur temporaire quand la map change ou s'ouvre
        if (baseMap?.meterByPx) {
            setTempMeterByPx(baseMap.meterByPx);
        } else {
            setTempMeterByPx("");
        }
    }, [baseMap?.meterByPx]);

    // --- Helpers ---
    const noScale = !Boolean(baseMap?.meterByPx);
    const scaleS = baseMap?.meterByPx
        ? `Echelle: 1 px = ${Number(baseMap.meterByPx).toFixed(3)} m`
        : "";

    // --- Handlers ---
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const handleSave = async () => {
        if (tempMeterByPx) {
            // Conversion en nombre pour la sauvegarde
            await updateEntity(baseMap?.id, { meterByPx: Number(tempMeterByPx) });
        } else {
            await updateEntity(baseMap?.id, { meterByPx: null })
        }
        handleClose();
    };

    return (
        <Box sx={{ p: 1 }}>
            {/* Ligne d'affichage : Texte + Bouton Edit */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 32
                }}
            >
                {noScale ? (
                    <Typography variant="body2" color="error.main">
                        {noScaleS}
                    </Typography>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {scaleS}
                    </Typography>
                )}

                <IconButton onClick={handleOpen} size="small" sx={{ ml: 1 }}>
                    <EditIcon fontSize="small" />
                </IconButton>
            </Box>

            {/* Dialog d'édition commun aux deux cas */}
            <DialogGeneric open={open} onClose={handleClose} title="Modifier l'échelle">
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body2">
                        Entrez la valeur en mètres pour 1 pixel.
                    </Typography>

                    <FieldTextV2
                        label="Mètres par pixel"
                        value={tempMeterByPx}
                        onChange={setTempMeterByPx}
                        type="number" // Important pour forcer le clavier numérique sur mobile
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant="contained" onClick={handleSave}>
                            {saveS}
                        </Button>
                    </Box>
                </Box>
            </DialogGeneric>
        </Box>
    );
}