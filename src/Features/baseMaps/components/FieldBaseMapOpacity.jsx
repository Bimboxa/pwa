import { useState, useEffect, useMemo } from "react";

import { useDispatch } from "react-redux";

import { setBaseMapOpacity as setBaseMapOpacityRedux } from "Features/mapEditor/mapEditorSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMapListing from "../hooks/useMainBaseMapListing";

import { Box, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import FieldSlider from "Features/form/components/FieldSlider";
import throttle from "Features/misc/utils/throttle";

export default function FieldBaseMapOpacity({ baseMap, variant = "image" }) {
    const dispatch = useDispatch();
    const opacity = variant === "imageEnhanced" ? baseMap?.opacityEnhanced : baseMap?.opacity;
    const updateEntity = useUpdateEntity();
    const mainBaseMapListing = useMainBaseMapListing();

    const [localOpacity, setLocalOpacity] = useState(opacity);
    // État pour mémoriser l'ancienne valeur avant de masquer
    const [lastValue, setLastValue] = useState(opacity > 0 ? opacity : 1);

    useEffect(() => {
        setLocalOpacity(opacity);
        if (opacity > 0) setLastValue(opacity);
    }, [opacity]);

    const throttledUpdate = useMemo(
        () =>
            throttle((id, value) => {
                const updates = {}
                if (variant === "imageEnhanced") {
                    updates.opacityEnhanced = value;
                } else {
                    updates.opacity = value;
                }
                updateEntity(id, updates, { listing: mainBaseMapListing });
            }, 200),
        [updateEntity, variant, mainBaseMapListing?.id]
    );

    function handleChange(newValue) {
        setLocalOpacity(newValue);
        if (newValue > 0) setLastValue(newValue);
        if (variant === "image") dispatch(setBaseMapOpacityRedux(newValue));
        throttledUpdate(baseMap.id, newValue);
    }

    // Handler pour le bouton de visibilité
    function toggleVisibility() {
        const isVisible = localOpacity > 0;
        const nextValue = isVisible ? 0 : lastValue;

        setLocalOpacity(nextValue);
        if (variant === "image") dispatch(setBaseMapOpacityRedux(nextValue));
        // On envoie directement la mise à jour sans throttle pour une réactivité maximale au clic
        const updates = variant === "imageEnhanced"
            ? { opacityEnhanced: nextValue }
            : { opacity: nextValue };

        updateEntity(baseMap.id, updates, { listing: mainBaseMapListing });
    }

    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            width: 1,
            p: 1,
            borderBottom: theme => `1px solid ${theme.palette.divider}`,
            gap: 1 // Ajout d'un petit espace entre le slider et le bouton
        }}>
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: "center" }}>
                <FieldSlider
                    label="Opacité"
                    value={localOpacity ?? 1}
                    onChange={handleChange}
                />
            </Box>

            <Box sx={{ display: 'flex', alignItems: "center" }}>
                <IconButton
                    onClick={toggleVisibility}
                    size="small"
                >
                    {localOpacity > 0 ? (
                        <Visibility fontSize="small" />
                    ) : (
                        <VisibilityOff fontSize="small" color="error" />
                    )}
                </IconButton>
            </Box>
        </Box>
    );
}