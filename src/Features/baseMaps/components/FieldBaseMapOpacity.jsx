import { useState, useEffect, useMemo } from "react";

import { useDispatch } from "react-redux";

import { setBaseMapOpacity as setBaseMapOpacityRedux } from "Features/mapEditor/mapEditorSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMapListing from "../hooks/useMainBaseMapListing";

import { Box, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import FieldSlider from "Features/form/components/FieldSlider";
import throttle from "Features/misc/utils/throttle";

export default function FieldBaseMapOpacity({ baseMap }) {
    const dispatch = useDispatch();
    const opacity = baseMap?.opacity;
    const updateEntity = useUpdateEntity();
    const mainBaseMapListing = useMainBaseMapListing();

    const [localOpacity, setLocalOpacity] = useState(opacity);
    const [lastValue, setLastValue] = useState(opacity > 0 ? opacity : 1);

    useEffect(() => {
        setLocalOpacity(opacity);
        if (opacity > 0) setLastValue(opacity);
    }, [opacity]);

    const throttledUpdate = useMemo(
        () =>
            throttle((id, value) => {
                updateEntity(id, { opacity: value }, { listing: mainBaseMapListing });
            }, 200),
        [updateEntity, mainBaseMapListing?.id]
    );

    function handleChange(newValue) {
        setLocalOpacity(newValue);
        if (newValue > 0) setLastValue(newValue);
        dispatch(setBaseMapOpacityRedux(newValue));
        throttledUpdate(baseMap.id, newValue);
    }

    function toggleVisibility() {
        const isVisible = localOpacity > 0;
        const nextValue = isVisible ? 0 : lastValue;

        setLocalOpacity(nextValue);
        dispatch(setBaseMapOpacityRedux(nextValue));
        updateEntity(baseMap.id, { opacity: nextValue }, { listing: mainBaseMapListing });
    }

    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            width: 1,
            p: 1,
            gap: 1
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
