import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";

import { Paper, Box } from "@mui/material";
import { Mouse, Rectangle, WaterDrop } from "@mui/icons-material";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import theme from "Styles/theme";

export default function ToolbarEnabledDrawingMode() {

    const dispatch = useDispatch();

    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    // helper

    const color = newAnnotation?.strokeColor ?? newAnnotation?.fillColor ?? theme.palette.secondary.main;

    // options

    const options = [
        {
            key: "CLICK",
            label: "Clic",
            icon: <Mouse sx={{ color }} />,
            show: true
        },
        {
            key: "RECTANGLE",
            label: "Rectangle",
            icon: <Rectangle sx={{ color }} />,
            show: true
        },
        {
            key: "DROP_FILL",
            label: "Remplissage",
            icon: <WaterDrop sx={{ color }} />,
            show: ["POLYGON"].includes(type)
        }
    ]

    // helpers - show mode

    const showMode = ["POLYLINE", "POLYGON", "CUT"].includes(type);

    // handlers

    function handleChange(mode) {
        dispatch(setEnabledDrawingMode(mode));
    }

    // render

    if (!showMode) return null;

    return <Paper
        sx={{ display: "flex", alignItems: "center", p: 1 }
        }>
        <ToggleSingleSelectorGeneric
            options={options.filter(o => o.show)}
            selectedKey={enabledDrawingMode}
            onChange={handleChange}
        />
    </Paper >

}