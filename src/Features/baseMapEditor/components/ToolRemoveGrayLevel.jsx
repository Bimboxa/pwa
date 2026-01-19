import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import throttle from "Features/misc/utils/throttle";

import { setGrayLevelThreshold } from "../baseMapEditorSlice";

import { Box, Slider, Button, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import cv from "Features/opencv/services/opencvService";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

export default function ToolRemoveGrayLevel({ onSave }) {
    const dispatch = useDispatch();

    // data

    const baseMap = useMainBaseMap();
    const update = useUpdateBaseMapWithImageEnhanced();

    // Récupération de la valeur (0 = coupe tout / noir, 255 = laisse tout passer / blanc)
    const grayLevelThreshold = useSelector((s) => s.baseMapEditor.grayLevelThreshold) ?? 255;

    // State local
    const [localValue, setLocalValue] = useState(grayLevelThreshold);

    useEffect(() => {
        setLocalValue(grayLevelThreshold);
    }, [grayLevelThreshold]);

    // --- OPTIMISATION DU DISPATCH ---
    const dispatchThrottled = useMemo(
        () =>
            throttle((newValue) => {
                dispatch(setGrayLevelThreshold(newValue));
            }, 200),
        [dispatch]
    );

    const handleChange = (event, sliderPosition) => {
        // INVERSION DE LOGIQUE ICI :
        // La position du slider va de 0 (Gauche) à 255 (Droite).
        // Mais tu veux que Droite = 0 (Coupe tout) et Gauche = 255 (Laisse tout).
        const realThresholdValue = 255 - sliderPosition;

        setLocalValue(realThresholdValue);
        dispatchThrottled(realThresholdValue);
    };

    const handleValidate = async () => {
        await cv.load();
        const { processedImageFile } = await cv.applyGrayLevelThresholdAsync({
            imageUrl: baseMap.getUrl(),
            grayLevelThreshold,
        });
        if (processedImageFile) {
            update(baseMap?.id, processedImageFile);
        }
    };

    // --- Calcul de la couleur du rond ---
    // Si localValue = 255 (Gauche), c'est Blanc.
    // Si localValue = 0 (Droite), c'est Noir.
    const intensity = localValue;
    const thumbColor = `rgb(${intensity}, ${intensity}, ${intensity})`;
    // Bordure contrastée : si le rond est clair, bordure foncée, et inversement
    const thumbBorderColor = intensity > 128 ? "#000000" : "#ffffff";

    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            width: "100%",
            p: 1,
            bgcolor: "background.paper",
            borderRadius: 1
        }}>
            <Typography
                variant="body2"
                sx={{ minWidth: 30, fontWeight: "bold", color: "text.secondary" }}
            >
                {localValue}
            </Typography>

            <Slider
                // INVERSION POUR L'AFFICHAGE :
                // On transforme la valeur réelle (255) en position gauche (0)
                // On transforme la valeur réelle (0) en position droite (255)
                value={255 - localValue}
                min={0}
                max={255}
                onChange={handleChange}
                valueLabelDisplay="off" // On cache le label natif car il afficherait la valeur inversée
                sx={{
                    flexGrow: 1,
                    height: 12,
                    padding: "13px 0",

                    // 1. Le Rail (Fond) : Blanc (Gauche) vers Noir (Droite) -> INCHANGÉ
                    "& .MuiSlider-rail": {
                        opacity: 1,
                        background: "linear-gradient(90deg, #ffffff 0%, #000000 100%)",
                        border: "1px solid rgba(0,0,0,0.1)",
                    },

                    // 2. La Track (Partie gauche) : Blanche
                    // Plus on va à droite (plus on coupe), plus la barre blanche grandit.
                    "& .MuiSlider-track": {
                        backgroundColor: "#ffffff",
                        border: "1px solid #bdbdbd",
                        opacity: 1,
                    },

                    // 3. Le Pouce (Thumb)
                    "& .MuiSlider-thumb": {
                        height: 22,
                        width: 22,
                        backgroundColor: thumbColor,
                        border: `2px solid ${thumbBorderColor}`,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        "&:hover": {
                            boxShadow: `0 0 0 8px rgba(33, 150, 243, 0.16)`,
                        },
                        "&::before": { boxShadow: "none" }
                    },
                }}
            />

            <Button
                variant="contained"
                size="small"
                color="primary"
                onClick={handleValidate}
                startIcon={<CheckCircleIcon />}
                sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
                Valider
            </Button>
        </Box>
    );
}