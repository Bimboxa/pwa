import { useState, useEffect } from "react";
import { IconButton, Popover, Paper, Button, Box } from "@mui/material"; // J'ai remplacé ButtonInPanelV2 par Button standard pour l'exemple
import { AspectRatio as SizeIcon } from "@mui/icons-material";

import db from "App/db/db";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import FieldOptionKey from "Features/form/components/FieldOptionKey";

export default function IconButtonAnnotationBboxSize({ annotation }) {

    console.log("annotation Bbox", annotation.bbox);

    // data
    const baseMap = useMainBaseMap();

    const { width: baseMapWidth, height: baseMapHeight } = baseMap?.image?.imageSize || {};

    // const
    const meterByPx = baseMap?.meterByPx || 0;

    let optionsUnit = [{ key: "PX", label: "PX" }];
    if (meterByPx > 0) {
        optionsUnit.push({ key: "M", label: "M" });
    }

    // State
    // On stocke toujours la largeur/hauteur en PIXELS (valeur brute) dans le state
    const [widthPx, setWidthPx] = useState(null);
    const [heightPx, setHeightPx] = useState(null);
    const [unit, setUnit] = useState("PX");

    useEffect(() => {
        if (annotation?.id) {
            setWidthPx(annotation.bbox?.width * baseMapWidth);
            setHeightPx(annotation.bbox?.height * baseMapHeight);
            setUnit(annotation.bbox?.displayUnit ?? "PX");
        }
    }, [annotation?.id, baseMapWidth, baseMapHeight]);

    // Virtual Anchor pour le Popover
    const [virtualAnchor, setVirtualAnchor] = useState(null);
    const open = Boolean(virtualAnchor);

    // --- Helpers de conversion ---

    // Facteur de conversion : Si on est en Mètre, on multiplie les PX par meterByPx
    const conversionFactor = (unit === "M" && meterByPx > 0) ? meterByPx : 1;

    // Valeurs à afficher dans les champs (arrondies pour éviter les 100.0000001)
    // On divise par le facteur pour l'affichage ? Non, meterByPx = Mètres pour 1 Px.
    // Donc Distance(m) = Distance(px) * meterByPx.
    const displayWidth = Number((widthPx * conversionFactor).toFixed(3));
    const displayHeight = Number((heightPx * conversionFactor).toFixed(3));

    // --- Handlers ---

    const handleClick = (event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setVirtualAnchor({
            getBoundingClientRect: () => bounds,
            nodeType: 1,
        });
    };

    const handleClose = () => {
        setVirtualAnchor(null);
    };

    // Quand l'utilisateur change la valeur dans l'input
    const handleWidthChange = (val) => {
        const numVal = parseFloat(val);
        if (isNaN(numVal)) return;

        // On reconvertit en PX pour le state : Px = ValeurInput / Factor
        // Si Factor = 1 (PX), ça ne change rien.
        // Si Factor = 0.1 (M), et User tape 10m -> 10 / 0.1 = 100px.
        setWidthPx(numVal / conversionFactor);
    };

    const handleHeightChange = (val) => {
        const numVal = parseFloat(val);
        if (isNaN(numVal)) return;
        setHeightPx(numVal / conversionFactor);
    };

    const handleUnitChange = (newUnit) => {
        setUnit(newUnit);
    };

    const handleSaveClick = async () => {
        const { width, height } = baseMap.image.imageSize;
        await db.annotations.update(annotation.id, {
            bbox: {
                ...annotation.bbox,
                width: widthPx / width,
                height: heightPx / height,
                displayUnit: unit,
            },
        });
        handleClose();
    };

    return (
        <>
            <IconButton
                onClick={handleClick}
                color={open ? "primary" : "default"}
                size="small"
                disabled={Boolean(annotation.annotationTemplate?.size)}
            >
                <SizeIcon fontSize="small" />
            </IconButton>

            <Popover
                open={open}
                anchorEl={virtualAnchor}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
                PaperProps={{ sx: { mt: 1, overflow: "visible" } }}
            >
                <Paper sx={{ p: 2, width: 220 }}>
                    <Box display="flex" flexDirection="column" gap={2}>

                        {/* Sélecteur d'unité */}
                        <FieldOptionKey
                            label="Unité"
                            value={unit}
                            onChange={handleUnitChange}
                            valueOptions={optionsUnit}
                            size="small"
                        />

                        {/* Champs Dimensions */}
                        <Box display="flex" gap={1}>
                            <FieldTextV2
                                label="Largeur"
                                value={displayWidth}
                                onChange={handleWidthChange}
                                type="number"
                                size="small"
                            />
                            <FieldTextV2
                                label="Hauteur"
                                value={displayHeight}
                                onChange={handleHeightChange}
                                type="number"
                                size="small"
                            />
                        </Box>

                        {/* Bouton Sauvegarder */}
                        <Button
                            variant="contained"
                            onClick={handleSaveClick}
                            fullWidth
                            size="small"
                        >
                            Enregistrer
                        </Button>
                    </Box>
                </Paper>
            </Popover>
        </>
    );
}