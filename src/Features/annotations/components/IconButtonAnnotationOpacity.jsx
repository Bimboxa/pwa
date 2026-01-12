import { useState } from "react";
import { IconButton, Popover, Slider, Paper } from "@mui/material";
import OpacityIcon from "@mui/icons-material/Opacity";

import db from "App/db/db";

export default function IconButtonAnnotationOpacity({ annotation }) {
    // On ne stocke plus l'élément DOM, mais un "Virtual Element" (un objet JS simple)
    const [virtualAnchor, setVirtualAnchor] = useState(null);
    const [localOpacity, setLocalOpacity] = useState(annotation.opacity ?? 1);

    const open = Boolean(virtualAnchor);

    const handleClick = (event) => {
        // 1. On capture le rectangle (position/taille) du bouton à l'instant T
        const bounds = event.currentTarget.getBoundingClientRect();

        // 2. On crée un faux élément qui renvoie toujours ces coordonnées figées
        // Cela rend le Popover immunisé contre la destruction du bouton dans le DOM
        const virtualElement = {
            getBoundingClientRect: () => bounds,
            nodeType: 1, // Nécessaire pour faire croire à MUI que c'est un noeud DOM
        };

        setVirtualAnchor(virtualElement);
    };

    const handleClose = () => {
        setVirtualAnchor(null);
    };

    const handleSliderChange = (event, newValue) => {
        setLocalOpacity(newValue);
    };

    const handleSliderCommit = async (event, newValue) => {
        await db.annotations.update(annotation.id, {
            opacity: newValue,
        });
    };

    return (
        <>
            <IconButton
                onClick={handleClick}
                color={open ? "primary" : "default"}
            >
                <OpacityIcon />
            </IconButton>

            <Popover
                open={open}
                anchorEl={virtualAnchor} // On ancre sur l'objet virtuel
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "center",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "center",
                }}
                PaperProps={{
                    sx: {
                        overflow: "visible",
                        marginTop: 1.5,
                        //padding: 2,
                        boxShadow: 3,
                    }
                }}
            >
                <Paper sx={{ width: 150, display: "flex", px: 1 }}>
                    <Slider
                        size="small"
                        value={localOpacity}
                        min={0}
                        max={1}
                        step={0.01}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(x) => `${Math.round(x * 100)}%`}
                        onChange={handleSliderChange}
                        onChangeCommitted={handleSliderCommit}
                    />
                </Paper>
            </Popover>
        </>
    );
}