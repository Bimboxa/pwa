import React from 'react';
import { useSelector, useDispatch } from "react-redux";
import { Switch, Box, Typography } from "@mui/material";
import { setBaseMapGrayScale } from "../mapEditorSlice";

export default function SwitchBaseMapGrayScale() {
    const dispatch = useDispatch();
    const grayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);

    const handleChange = (event) => {
        dispatch(setBaseMapGrayScale(event.target.checked));
    };

    return (
        <Box sx={{ px: 1, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
                Noir & Blanc
            </Typography>
            <Switch
                checked={!!grayScale}
                onChange={handleChange}
                size="small"
            />
        </Box>
    );
}