import { useState, useEffect, useMemo } from "react";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import { Box } from "@mui/material";
import FieldSlider from "Features/form/components/FieldSlider";
import throttle from "Features/misc/utils/throttle";

export default function FieldBaseMapOpacity({ baseMap, variant = "image" }) {

    // const

    const opacity = variant === "imageEnhanced" ? baseMap?.opacityEnhanced : baseMap?.opacity;

    // data
    const updateEntity = useUpdateEntity();

    // 1. État local pour garantir la fluidité du Slider (Optimistic UI)
    // On initialise avec la valeur venant des props
    const [localOpacity, setLocalOpacity] = useState(opacity);

    // 2. Si la prop change depuis l'extérieur (ex: reset, undo/redo), on met à jour le local
    useEffect(() => {
        setLocalOpacity(opacity);
    }, [opacity]);

    // 3. Création de la fonction throttled STABLE via useMemo
    // Elle ne sera pas recréée à chaque render, donc le timer du throttle fonctionnera
    const throttledUpdate = useMemo(
        () =>
            throttle((id, value) => {
                const updates = {}
                if (variant === "imageEnhanced") {
                    updates.opacityEnhanced = value;
                } else {
                    updates.opacity = value;
                }
                updateEntity(id, updates);
            }, 200), // Exécute au maximum une fois toutes les 200ms
        [updateEntity]
    );

    // handlers
    function handleChange(newValue) {
        console.log("handleChange", newValue);
        // A. Mise à jour immédiate de l'UI (le slider bouge tout de suite)
        setLocalOpacity(newValue);

        // B. Appel serveur limité par le throttle
        throttledUpdate(baseMap.id, newValue);
    }

    // render
    return (
        <Box sx={{
            display: "flex", alignItems: "center", width: 1,
            p: 1,
            borderBottom: theme => `1px solid ${theme.palette.divider}`,
        }}>
            <FieldSlider
                label="Opacité"
                value={localOpacity ?? 1} // On utilise l'état local ici
                onChange={handleChange}
            />
        </Box>
    );
}